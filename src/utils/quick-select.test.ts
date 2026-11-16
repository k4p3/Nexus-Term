import { describe, it, expect } from "vitest";
import { assignLabels, buildHints, isValidIPv4, isValidIPv6, resolveLabel } from "./quick-select";

const kinds = (line: string) => buildHints([line]).map((h) => [h.kind, h.text]);

describe("quick select detection", () => {
  it("detects urls without trailing punctuation", () => {
    expect(kinds("ver https://example.com/a?b=1, ok")).toEqual([["url", "https://example.com/a?b=1"]]);
  });

  it("detects git hashes, uuids, emails and ips", () => {
    expect(kinds("commit 3f2a9c1d")).toEqual([["sha", "3f2a9c1d"]]);
    expect(kinds("id 123e4567-e89b-12d3-a456-426614174000")).toEqual([["uuid", "123e4567-e89b-12d3-a456-426614174000"]]);
    expect(kinds("mail root@example.org")).toEqual([["email", "root@example.org"]]);
    expect(kinds("host 192.168.1.10 up")).toEqual([["ipv4", "192.168.1.10"]]);
    expect(kinds("v6 2001:db8::1 ok")).toEqual([["ipv6", "2001:db8::1"]]);
  });

  it("detects absolute, home and relative paths", () => {
    expect(kinds("cat /etc/nginx/nginx.conf")).toEqual([["path", "/etc/nginx/nginx.conf"]]);
    expect(kinds("cd ~/projects/app")).toEqual([["path", "~/projects/app"]]);
    expect(kinds("edit src/main.rs now")).toEqual([["path", "src/main.rs"]]);
  });

  it("rejects false positives", () => {
    expect(kinds("999.1.1.1")).toEqual([]);
    expect(kinds("version 1.2.3.4.5")).toEqual([]);
    expect(kinds("time 12:34:56")).toEqual([]);
    expect(kinds("deadbeef")).toEqual([]); // sin dígito: no es un hash
    expect(kinds("and/or maybe")).toEqual([]);
  });

  it("detects long numbers only from 4 digits", () => {
    expect(kinds("pid 123 and 45678")).toEqual([["number", "45678"]]);
  });

  it("does not double-detect inside a url", () => {
    const h = kinds("curl https://10.0.0.1/path/file.txt");
    expect(h).toEqual([["url", "https://10.0.0.1/path/file.txt"]]);
  });

  it("validates ip helpers", () => {
    expect(isValidIPv4("255.255.255.255")).toBe(true);
    expect(isValidIPv4("256.0.0.1")).toBe(false);
    expect(isValidIPv6("::1")).toBe(true);
    expect(isValidIPv6("1:2:3:4:5:6:7:8")).toBe(true);
    expect(isValidIPv6("12:34:56")).toBe(false);
    expect(isValidIPv6("1::2::3")).toBe(false);
  });
});

describe("quick select labels", () => {
  it("assigns single letters when they fit and two-letter labels otherwise", () => {
    expect(assignLabels(3)).toEqual(["a", "s", "d"]);
    const many = assignLabels(30);
    expect(many.every((l) => l.length === 2)).toBe(true);
    expect(new Set(many).size).toBe(30);
  });

  it("labels are prefix-free", () => {
    for (const n of [5, 26, 27, 100]) {
      const labels = assignLabels(n);
      for (const a of labels) for (const b of labels) if (a !== b) expect(b.startsWith(a)).toBe(false);
    }
  });

  it("gives the same label to repeated values and labels bottom-up", () => {
    const hints = buildHints(["10.0.0.1", "10.0.0.2", "10.0.0.1"]);
    expect(hints).toHaveLength(3);
    expect(hints[0].label).toBe(hints[2].label);
    // el último distinto visto desde abajo (10.0.0.1) recibe la primera etiqueta
    expect(hints[2].label).toBe("a");
    expect(hints[1].label).toBe("s");
    expect(hints[1].row).toBe(1);
  });

  it("resolves typed labels: copy, paste with uppercase, prefix and none", () => {
    const hints = buildHints(["10.0.0.1"]);
    expect(resolveLabel("a", hints)).toMatchObject({ state: "match", paste: false });
    expect(resolveLabel("A", hints)).toMatchObject({ state: "match", paste: true });
    expect(resolveLabel("z", hints)).toEqual({ state: "none" });
    const two = buildHints(Array.from({ length: 30 }, (_, i) => `10.0.0.${i + 1}`));
    expect(resolveLabel("a", two)).toEqual({ state: "prefix" });
  });
});
