import { describe, it, expect } from "vitest";
import { skipReason, shouldRecordCommand, rankHistory, historyHostKey, MAX_HISTORY_COMMAND_BYTES } from "./history-filter";

describe("skipReason / shouldRecordCommand", () => {
  it("accepts ordinary commands", () => {
    for (const c of ["ls -la", "git commit -m 'fix'", "docker ps\n", "cd /var/log"]) {
      expect(shouldRecordCommand(c)).toBe(true);
    }
  });

  it("skips empty and whitespace-only commands", () => {
    expect(skipReason("")).toBe("empty");
    expect(skipReason("  \n")).toBe("empty");
  });

  it("skips commands starting with a space", () => {
    expect(skipReason(" echo hidden")).toBe("leading-space");
    expect(skipReason("\tls")).toBe("leading-space");
  });

  it("skips commands longer than 4 KiB (in bytes)", () => {
    expect(skipReason("x".repeat(MAX_HISTORY_COMMAND_BYTES))).toBeNull();
    expect(skipReason("x".repeat(MAX_HISTORY_COMMAND_BYTES + 1))).toBe("too-long");
    expect(skipReason("é".repeat(MAX_HISTORY_COMMAND_BYTES / 2 + 1))).toBe("too-long");
  });

  it("skips commands that look like they contain secrets", () => {
    const secrets = [
      "mysql -u root --password=hunter2",
      "curl -H 'Authorization: Bearer abc' https://x",
      "export AWS_SECRET_ACCESS_KEY=abc",
      "export GITHUB_TOKEN=ghp_x",
      "passwd root",
      "API_KEY=abc ./run.sh",
      "echo $api-key",
      "login --token abc",
    ];
    for (const c of secrets) expect(skipReason(c), c).toBe("secret");
  });

  it("does not flag unrelated exports", () => {
    expect(shouldRecordCommand("export PATH=$PATH:/opt/bin")).toBe(true);
  });
});

describe("rankHistory", () => {
  const e = (text: string, use_count: number, last_used_at: string) => ({ text, use_count, last_used_at });

  it("keeps the incoming order without a query", () => {
    const items = [e("b", 1, "2"), e("a", 9, "1")];
    expect(rankHistory(items, "  ")).toEqual(items);
  });

  it("drops entries that do not match", () => {
    expect(rankHistory([e("ls", 1, "1"), e("pwd", 1, "1")], "ls").map((x) => x.text)).toEqual(["ls"]);
  });

  it("ranks by fuzzy score first", () => {
    const items = [e("grep -r foo .", 50, "9"), e("foo", 1, "1")];
    expect(rankHistory(items, "foo")[0].text).toBe("foo");
  });

  it("breaks score ties by use count and then by recency", () => {
    const a = e("ssh a", 1, "2026-01-02");
    const b = e("ssh b", 5, "2026-01-01");
    expect(rankHistory([a, b], "ssh").map((x) => x.text)).toEqual(["ssh b", "ssh a"]);
    const c = e("ssh c", 1, "2026-01-03");
    expect(rankHistory([a, c], "ssh").map((x) => x.text)).toEqual(["ssh c", "ssh a"]);
  });
});

describe("historyHostKey", () => {
  it("uses 'local' for shells without a host", () => {
    expect(historyHostKey(undefined)).toBe("local");
    expect(historyHostKey(null)).toBe("local");
    expect(historyHostKey("")).toBe("local");
    expect(historyHostKey("h1")).toBe("h1");
  });
});
