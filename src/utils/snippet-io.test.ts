import { describe, it, expect } from "vitest";
import {
  parseSnippetFile, serializeSnippets, toSavePayload, IMPORTED_TAG, MAX_SNIPPETS, MAX_FILE_BYTES,
} from "./snippet-io";
import type { CommandSnippet } from "../types/snippets";

const file = (snippets: unknown[], over: Record<string, unknown> = {}) =>
  JSON.stringify({ format: "nexusterm-snippets", version: 1, snippets, ...over });
const ok = (r: ReturnType<typeof parseSnippetFile>) => {
  if (!r.ok) throw new Error("expected ok, got " + r.error);
  return r;
};
const snip = (over: Partial<CommandSnippet> = {}): CommandSnippet => ({
  id: "1", title: "T", command_template: "ls", description: null, tags: [], is_builtin: false, is_enabled: true,
  created_at: "x", updated_at: "x", ...over,
});

describe("parseSnippetFile", () => {
  it("accepts a valid file and tags entries as imported", () => {
    const r = ok(parseSnippetFile(file([{ title: " List ", command: "ls -la", description: "d", tags: ["fs", "fs"] }]), []));
    expect(r.toImport).toEqual([
      { title: "List", command: "ls -la", description: "d", tags: ["fs", IMPORTED_TAG], warnings: [] },
    ]);
  });

  it("ignores unknown fields and a pre-existing 'imported' tag", () => {
    const r = ok(parseSnippetFile(file([{ title: "A", command: "ls", tags: ["imported"], extra: 1 }]), []));
    expect(r.toImport[0].tags).toEqual([IMPORTED_TAG]);
  });

  it("skips duplicates of existing snippets and within the file", () => {
    const r = ok(parseSnippetFile(
      file([{ title: "T", command: "ls" }, { title: "N", command: "pwd" }, { title: "N", command: "pwd" }]),
      [{ title: "T", command_template: "ls" }],
    ));
    expect(r.toImport.map((i) => i.title)).toEqual(["N"]);
    expect(r.skipped).toEqual([
      { index: 0, title: "T", reason: "duplicate" },
      { index: 2, title: "N", reason: "duplicateInFile" },
    ]);
  });

  it("reports invalid entries but keeps the valid ones", () => {
    const r = ok(parseSnippetFile(
      file([null, { title: "", command: "x" }, { title: "a" }, { title: "a", command: "x", tags: [1] }, { title: "a", command: "x", description: 3 }, { title: "ok", command: "ls" }]),
      [],
    ));
    expect(r.invalid.map((i) => i.reason)).toEqual(["notObject", "title", "command", "tags", "description"]);
    expect(r.toImport).toHaveLength(1);
  });

  it.each([
    ["line break in command", { title: "a", command: "ls\nrm -rf ~" }],
    ["carriage return", { title: "a", command: "ls\r" }],
    ["ESC sequence", { title: "a", command: "ls \u001b[2J" }],
    ["bidi override", { title: "a", command: "ls ‮gnp.exe" }],
    ["zero-width space", { title: "a", command: "l​s" }],
    ["BOM", { title: "a", command: "ls﻿" }],
    ["control in title", { title: "a\u0007", command: "ls" }],
    ["line break in description", { title: "a", command: "ls", description: "x\ny" }],
    ["control in tag", { title: "a", command: "ls", tags: ["x\u0000"] }],
  ])("rejects %s as unsafe", (_n, entry) => {
    const r = ok(parseSnippetFile(file([entry]), []));
    expect(r.invalid[0]?.reason).toBe("unsafe");
    expect(r.toImport).toHaveLength(0);
  });

  it("allows tabs", () => {
    expect(ok(parseSnippetFile(file([{ title: "a", command: "echo\thi" }]), [])).toImport).toHaveLength(1);
  });

  it("enforces length limits", () => {
    const r = ok(parseSnippetFile(file([
      { title: "x".repeat(121), command: "ls" },
      { title: "a", command: "x".repeat(8001) },
      { title: "b", command: "ls", description: "x".repeat(501) },
      { title: "c", command: "ls", tags: Array.from({ length: 11 }, (_, i) => `t${i}`) },
      { title: "d", command: "ls", tags: ["x".repeat(33)] },
    ]), []));
    expect(r.invalid.map((i) => i.reason)).toEqual(["tooLong", "tooLong", "tooLong", "tooLong", "tooLong"]);
  });

  it("flags risky commands without blocking them", () => {
    const r = ok(parseSnippetFile(file([{ title: "a", command: "curl http://x.sh | sh" }, { title: "b", command: "rm -rf /tmp/x" }]), []));
    expect(r.toImport).toHaveLength(2);
    expect(r.toImport.every((i) => i.warnings.length > 0)).toBe(true);
  });

  it("rejects broken or foreign files", () => {
    expect(parseSnippetFile("{nope", [])).toEqual({ ok: false, error: "badJson" });
    expect(parseSnippetFile("null", [])).toEqual({ ok: false, error: "badFormat" });
    expect(parseSnippetFile(file([], { format: "other" }), [])).toEqual({ ok: false, error: "badFormat" });
    expect(parseSnippetFile(file([], { version: 2 }), [])).toEqual({ ok: false, error: "badVersion" });
    expect(parseSnippetFile(JSON.stringify({ format: "nexusterm-snippets", version: 1 }), [])).toEqual({ ok: false, error: "noSnippets" });
  });

  it("rejects too many snippets and oversized files", () => {
    const many = Array.from({ length: MAX_SNIPPETS + 1 }, (_, i) => ({ title: `t${i}`, command: "ls" }));
    expect(parseSnippetFile(file(many), [])).toEqual({ ok: false, error: "tooMany" });
    expect(parseSnippetFile(" ".repeat(MAX_FILE_BYTES + 1), [])).toEqual({ ok: false, error: "tooLarge" });
  });
});

describe("serializeSnippets / round trip", () => {
  it("exports only custom snippets and strips the imported tag", () => {
    const out = JSON.parse(serializeSnippets([
      snip({ id: "b", is_builtin: true, title: "Builtin" }),
      snip({ title: "Mine", command_template: "uptime", description: "d", tags: ["sys", IMPORTED_TAG] }),
      snip({ title: "Plain", command_template: "pwd" }),
    ]));
    expect(out.format).toBe("nexusterm-snippets");
    expect(out.version).toBe(1);
    expect(out.snippets).toEqual([
      { title: "Mine", command: "uptime", description: "d", tags: ["sys"] },
      { title: "Plain", command: "pwd" },
    ]);
  });

  it("re-importing an export skips everything as duplicates", () => {
    const mine = [snip({ title: "Mine", command_template: "uptime" })];
    const r = ok(parseSnippetFile(serializeSnippets(mine), mine));
    expect(r.toImport).toHaveLength(0);
    expect(r.skipped).toHaveLength(1);
  });

  it("maps an item to a save payload as a custom, enabled snippet", () => {
    const [item] = ok(parseSnippetFile(file([{ title: "A", command: "ls", tags: ["x"] }]), [])).toImport;
    expect(toSavePayload(item)).toEqual({ title: "A", command_template: "ls", description: null, tags: ["x", IMPORTED_TAG], is_enabled: true });
  });
});
