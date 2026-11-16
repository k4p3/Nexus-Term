import { describe, it, expect } from "vitest";
import { fuzzyFilter, fuzzyScore } from "./fuzzy";

describe("fuzzy", () => {
  it("returns null when the query is not a subsequence", () => {
    expect(fuzzyScore("xyz", "split pane")).toBeNull();
    expect(fuzzyScore("tp", "pt")).toBeNull();
  });

  it("empty query scores 0 and keeps everything", () => {
    expect(fuzzyScore("", "abc")).toBe(0);
    expect(fuzzyFilter(["a", "b"], "  ", (x) => x)).toEqual(["a", "b"]);
  });

  it("ranks prefixes and word starts above scattered matches", () => {
    const items = ["Toggle broadcast", "Split vertically", "Close pane", "Search buffer"];
    expect(fuzzyFilter(items, "sp", (x) => x)[0]).toBe("Split vertically");
    expect(fuzzyFilter(items, "cp", (x) => x)[0]).toBe("Close pane");
  });

  it("is case-insensitive and prefers consecutive matches", () => {
    expect(fuzzyScore("SPLIT", "split")).not.toBeNull();
    expect(fuzzyScore("spl", "split")!).toBeGreaterThan(fuzzyScore("spl", "s p l")!);
  });
});
