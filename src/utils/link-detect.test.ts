import { describe, it, expect } from "vitest";
import { dirname, findIpLinks, findPathLinks } from "./link-detect";

describe("path links", () => {
  it("detects path, path:line and path:line:col", () => {
    expect(findPathLinks("error in src/main.rs:10:5 here")).toEqual([
      { start: 9, end: 25, text: "src/main.rs:10:5", path: "src/main.rs", line: 10, col: 5 },
    ]);
    const one = findPathLinks("see /var/log/syslog:42")[0];
    expect(one).toMatchObject({ path: "/var/log/syslog", line: 42, col: undefined });
    expect(findPathLinks("open ./a/b.txt")[0].path).toBe("./a/b.txt");
    expect(findPathLinks("cd ~/proj")[0].path).toBe("~/proj");
  });

  it("strips trailing punctuation and ignores urls and bare slashes", () => {
    expect(findPathLinks("see /etc/hosts.")[0].path).toBe("/etc/hosts");
    expect(findPathLinks("https://example.com/a/b")).toEqual([]);
    expect(findPathLinks("a / b")).toEqual([]);
  });

  it("computes dirname", () => {
    expect(dirname("/a/b/c.txt")).toBe("/a/b");
    expect(dirname("/c.txt")).toBe("/");
    expect(dirname("c.txt")).toBe(".");
  });
});

describe("ip links", () => {
  it("detects valid IPv4 and IPv6", () => {
    expect(findIpLinks("ping 10.0.0.1 and 2001:db8::1")).toEqual([
      { start: 5, end: 13, ip: "10.0.0.1" },
      { start: 18, end: 29, ip: "2001:db8::1" },
    ]);
  });

  it("ignores invalid addresses and version strings", () => {
    expect(findIpLinks("999.1.1.1")).toEqual([]);
    expect(findIpLinks("1.2.3.4.5")).toEqual([]);
    expect(findIpLinks("time 12:34:56")).toEqual([]);
  });
});
