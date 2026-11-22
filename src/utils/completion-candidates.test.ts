import { describe, it, expect } from "vitest";
import { buildCandidates, toCandidates, rankCandidates } from "./completion-candidates";
import type { HistoryEntry } from "../types/history";

const h = (id: string, command: string, use = 1, exit: number | null = 0, at = "2026-01-01T00:00:00Z"): HistoryEntry =>
  ({ id, host_id: "x", command, use_count: use, last_exit_code: exit, last_used_at: at });
const sn = (id: string, title: string, tpl: string) => ({ id, title, command_template: tpl });
const on = { historyEnabled: true };

describe("completion candidates", () => {
  it("builds history and snippet candidates with stable ids", () => {
    const c = toCandidates([h("1", "ls -la")], [sn("a", "Disk", "df -h")]);
    expect(c.map((x) => x.id)).toEqual(["h:1", "s:a"]);
    expect(c[1]).toMatchObject({ kind: "snippet", text: "df -h", snippetId: "a" });
  });

  it("keeps the received order without a query", () => {
    const r = buildCandidates([h("1", "a"), h("2", "b")], [], "", on);
    expect(r.map((c) => c.text)).toEqual(["a", "b"]);
  });

  it("filters and ranks by fuzzy match, then usage", () => {
    const r = buildCandidates(
      [h("1", "git status", 1), h("2", "git stash", 9), h("3", "ls")],
      [],
      "git st",
      on,
    );
    expect(r.map((c) => c.text)).toEqual(["git stash", "git status"]);
  });

  it("matches snippets by title or template", () => {
    const r = buildCandidates([], [sn("a", "Disk usage", "df -h")], "disk", on);
    expect(r).toHaveLength(1);
  });

  it("never offers history entries that match secret patterns", () => {
    const r = buildCandidates(
      [h("1", "export API_KEY=abc"), h("2", "curl -u x --password y"), h("3", "echo ok")],
      [],
      "",
      on,
    );
    expect(r.map((c) => c.text)).toEqual(["echo ok"]);
  });

  it("does not filter user snippets that mention secrets", () => {
    const r = buildCandidates([], [sn("a", "Auth", 'curl -H "Authorization: Bearer {{token}}"')], "", on);
    expect(r).toHaveLength(1);
  });

  it("offers only snippets when history is disabled", () => {
    const r = buildCandidates([h("1", "ls")], [sn("a", "T", "pwd")], "", { historyEnabled: false });
    expect(r.map((c) => c.id)).toEqual(["s:a"]);
  });

  it("hides the candidate that equals what is already typed", () => {
    const r = buildCandidates([h("1", "ls"), h("2", "ls -la")], [], "ls", on);
    expect(r.map((c) => c.text)).toEqual(["ls -la"]);
  });

  it("applies the limit", () => {
    const entries = Array.from({ length: 10 }, (_, i) => h(String(i), `cmd${i}`));
    expect(buildCandidates(entries, [], "", { ...on, limit: 3 })).toHaveLength(3);
  });

  it("rankCandidates drops non-matching entries", () => {
    const c = toCandidates([h("1", "ls"), h("2", "docker ps")], []);
    expect(rankCandidates(c, "dock").map((x) => x.text)).toEqual(["docker ps"]);
  });
});
