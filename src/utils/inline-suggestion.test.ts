import { describe, it, expect } from "vitest";
import { readInputLine, suggestFor, nextWord, type InputTermLike } from "./inline-suggestion";
import type { HistoryEntry } from "../types/history";

const entry = (id: string, command: string, use = 1, last = "2026-01-01"): HistoryEntry => ({
  id, host_id: "local", command, use_count: use, last_exit_code: 0, last_used_at: last,
});

describe("suggestFor", () => {
  it("returns only the suffix of the best prefix match", () => {
    expect(suggestFor("git ch", [entry("1", "git checkout main")], [], true)).toBe("eckout main");
  });
  it("prefers more used then more recent", () => {
    const h = [entry("1", "git status", 1, "2026-02-01"), entry("2", "git stash", 5, "2026-01-01")];
    expect(suggestFor("git st", h, [], true)).toBe("ash");
    const h2 = [entry("1", "git status", 2, "2026-01-01"), entry("2", "git stash", 2, "2026-03-01")];
    expect(suggestFor("git st", h2, [], true)).toBe("ash");
  });
  it("needs at least 2 chars and no exact or multiline match", () => {
    expect(suggestFor("g", [entry("1", "git status")], [], true)).toBeNull();
    expect(suggestFor("git status", [entry("1", "git status")], [], true)).toBeNull();
    expect(suggestFor("ab", [entry("1", "ab\ncd")], [], true)).toBeNull();
    expect(suggestFor("a\nb", [entry("1", "a\nbcd")], [], true)).toBeNull();
  });
  it("is case sensitive", () => {
    expect(suggestFor("Git", [entry("1", "git status")], [], true)).toBeNull();
  });
  it("never suggests secrets", () => {
    expect(suggestFor("export TOKEN", [entry("1", "export TOKEN=abc123secretvalue")], [], true)).toBeNull();
  });
  it("ignores history when disabled but still uses plain snippets", () => {
    const sn = [{ id: "s", title: "t", command_template: "docker compose ps" }];
    expect(suggestFor("docker co", [entry("1", "docker container ls")], sn, false)).toBe("mpose ps");
  });
  it("skips snippets with parameters", () => {
    const sn = [{ id: "s", title: "t", command_template: "docker logs {{container}}" }];
    expect(suggestFor("docker lo", [], sn, true)).toBeNull();
  });
  it("history wins over snippets", () => {
    const sn = [{ id: "s", title: "t", command_template: "docker ps -a" }];
    expect(suggestFor("docker ps", [entry("1", "docker ps --format x")], sn, true)).toBe(" --format x");
  });
});

describe("nextWord", () => {
  it("takes the next word with leading spaces", () => {
    expect(nextWord("eckout main")).toBe("eckout");
    expect(nextWord(" main --force")).toBe(" main");
    expect(nextWord("")).toBe("");
    expect(nextWord("   ")).toBe("");
  });
});

// Pantalla simulada: líneas {text, wrapped}
function fakeTerm(lines: { text: string; wrapped?: boolean }[], cursorY: number, cursorX: number): InputTermLike {
  return {
    buffer: {
      active: {
        baseY: 0, cursorX, cursorY,
        getLine: (y: number) => {
          const l = lines[y];
          if (!l) return undefined;
          return {
            isWrapped: !!l.wrapped,
            translateToString: (trim = false, s = 0, e?: number) => {
              let t = l.text.slice(s, e);
              if (trim) t = t.replace(/\s+$/u, "");
              return t;
            },
          };
        },
      },
    },
  };
}
const marker = (line: number) => ({ id: 1, line, isDisposed: false, onDispose: () => ({ dispose() {} }), dispose() {} });

describe("readInputLine", () => {
  const block = { commandStart: marker(0), commandStartX: 2 };
  it("reads text between B and the cursor", () => {
    const t = fakeTerm([{ text: "$ git ch" }], 0, 8);
    expect(readInputLine(t, block)).toEqual({ text: "git ch", atEnd: true });
  });
  it("reports cursor not at end when text follows it", () => {
    const t = fakeTerm([{ text: "$ git checkout" }], 0, 8);
    expect(readInputLine(t, block)).toEqual({ text: "git ch", atEnd: false });
  });
  it("keeps trailing spaces typed", () => {
    const t = fakeTerm([{ text: "$ git  " }], 0, 7);
    expect(readInputLine(t, block)?.text).toBe("git  ");
  });
  it("joins wrapped rows but rejects real multiline", () => {
    const wrapped = fakeTerm([{ text: "$ aaaa" }, { text: "bb", wrapped: true }], 1, 2);
    expect(readInputLine(wrapped, block)?.text).toBe("aaaabb");
    const multi = fakeTerm([{ text: "$ aaaa" }, { text: "bb" }], 1, 2);
    expect(readInputLine(multi, block)).toBeNull();
  });
  it("is null without B, after C, or with the cursor before the input", () => {
    const t = fakeTerm([{ text: "$ ls" }], 0, 4);
    expect(readInputLine(t, undefined)).toBeNull();
    expect(readInputLine(t, { commandStartX: 2 })).toBeNull();
    expect(readInputLine(t, { ...block, outputStart: marker(1) })).toBeNull();
    expect(readInputLine(fakeTerm([{ text: "$ ls" }], 0, 1), block)).toBeNull();
  });
  it("gives up when the input spans too many rows", () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ text: "x", wrapped: i > 0 }));
    expect(readInputLine(fakeTerm(rows, 6, 1), block)).toBeNull();
  });
});
