import { describe, it, expect } from "vitest";
import { LineBuffer } from "./line-buffer";

const type = (b: LineBuffer, s: string) => { for (const ch of s) b.feed(ch); };

describe("LineBuffer", () => {
  it("accumulates printable characters, including multi-byte ones", () => {
    const b = new LineBuffer();
    type(b, "git ñ€");
    expect(b.text).toBe("git ñ€");
    expect(b.reliable).toBe(true);
  });

  it("handles Backspace by code point", () => {
    const b = new LineBuffer();
    type(b, "ab€");
    b.feed("\x7f");
    expect(b.text).toBe("ab");
    b.feed("\b");
    expect(b.text).toBe("a");
    b.feed("\x7f"); b.feed("\x7f");
    expect(b.text).toBe("");
  });

  it("handles Ctrl+U and Ctrl+W", () => {
    const b = new LineBuffer();
    type(b, "docker run   nginx");
    b.feed("\x17");
    expect(b.text).toBe("docker run   ");
    b.feed("\x17");
    expect(b.text).toBe("docker ");
    b.feed("\x15");
    expect(b.text).toBe("");
  });

  it("resets on Enter, newline and Ctrl+C, recovering reliability", () => {
    for (const key of ["\r", "\n", "\x03"]) {
      const b = new LineBuffer();
      type(b, "ls");
      b.feed("\t");
      expect(b.reliable).toBe(false);
      b.feed(key);
      expect(b.text).toBe("");
      expect(b.reliable).toBe(true);
    }
  });

  it("marks the line unreliable on ambiguous keys", () => {
    for (const key of ["\x1b[A", "\x1b[D", "\t", "\x12", "\x01", "\x10", "\x1bb"]) {
      const b = new LineBuffer();
      type(b, "ls");
      b.feed(key);
      expect(b.reliable).toBe(false);
    }
  });

  it("marks pasted text as unreliable, but not bare Enter inside it", () => {
    const b = new LineBuffer();
    b.feed("echo hello");
    expect(b.reliable).toBe(false);
    const c = new LineBuffer();
    c.feed("echo a\rtail");
    expect(c.reliable).toBe(true);
    expect(c.text).toBe("tail");
  });

  it("ignores controls that do not change the text at end of line", () => {
    const b = new LineBuffer();
    type(b, "ls");
    for (const k of ["\x04", "\x05", "\x0b", "\x0c"]) b.feed(k);
    expect(b.text).toBe("ls");
    expect(b.reliable).toBe(true);
  });

  it("stays unreliable until reset even if more characters are typed", () => {
    const b = new LineBuffer();
    b.feed("\x1b[A");
    type(b, "abc");
    expect(b.reliable).toBe(false);
    b.feed("\r");
    expect(b.reliable).toBe(true);
  });

  it("set() replaces the line and restores reliability", () => {
    const b = new LineBuffer();
    b.feed("\t");
    b.set("ls -la");
    expect(b.text).toBe("ls -la");
    expect(b.reliable).toBe(true);
  });
});
