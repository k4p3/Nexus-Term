import { describe, it, expect } from "vitest";
import { BlockTracker, searchInRange, formatDuration, type TermLike, type MarkerLike } from "./command-blocks";

class FakeTerm implements TermLike {
  lines: { text: string; wrapped: boolean }[] = [];
  markers: (MarkerLike & { _line: number; _cbs: (() => void)[]; _disposed: boolean })[] = [];
  cx = 0;
  baseY = 0;
  get buffer() {
    const self = this;
    return {
      active: {
        get baseY() { return self.baseY; },
        get cursorX() { return self.cx; },
        get cursorY() { return Math.max(0, self.lines.length - 1 - self.baseY); },
        getLine: (y: number) => {
          const l = self.lines[y];
          if (!l) return undefined;
          return {
            isWrapped: l.wrapped,
            translateToString: (_t?: boolean, s = 0) => l.text.slice(s),
          };
        },
      },
    };
  }
  write(text: string, wrapped = false) {
    this.lines.push({ text, wrapped });
  }
  get curLine() { return this.lines.length - 1; }
  registerMarker() {
    const self = this;
    const m = {
      id: this.markers.length + 1,
      _line: this.curLine,
      _cbs: [] as (() => void)[],
      _disposed: false,
      get line() { return this._disposed ? -1 : this._line; },
      get isDisposed() { return this._disposed; },
      onDispose(cb: () => void) { this._cbs.push(cb); return { dispose() {} }; },
      dispose() { if (this._disposed) return; this._disposed = true; this._cbs.forEach((c) => c()); },
    };
    this.markers.push(m);
    void self;
    return m;
  }
  /** Simula el recorte del scrollback: elimina n líneas del inicio. */
  trim(n: number) {
    this.lines.splice(0, n);
    for (const m of this.markers) {
      if (m._disposed) continue;
      m._line -= n;
      if (m._line < 0) m.dispose();
    }
  }
}

function runCommand(t: FakeTerm, tr: BlockTracker, cmd: string, out: string[], code = 0, t0 = 0, t1 = 1500) {
  t.write("$ ");
  tr.onOsc("A", [], t0);
  t.cx = 2;
  tr.onOsc("B");
  t.lines[t.curLine].text = "$ " + cmd;
  t.write(out[0] ?? "");
  t.cx = 0;
  tr.onOsc("C", [], t0);
  for (let i = 1; i < out.length; i++) t.write(out[i]);
  t.write("");
  tr.onOsc("D", [String(code)], t1);
}

describe("BlockTracker", () => {
  it("tracks a block with command, output, exit code and duration", () => {
    const t = new FakeTerm();
    const tr = new BlockTracker(t);
    runCommand(t, tr, "ls -la", ["a.txt", "b.txt"], 0, 100, 1600);
    const b = tr.blocks()[0];
    expect(tr.commandText(b)).toBe("ls -la");
    expect(tr.outputText(b)).toBe("a.txt\nb.txt");
    expect(b.exitCode).toBe(0);
    expect(b.durationMs).toBe(1500);
  });

  it("returns the finished block on D and records failures", () => {
    const t = new FakeTerm();
    const tr = new BlockTracker(t);
    runCommand(t, tr, "false", ["x"], 1);
    expect(tr.blocks()[0].exitCode).toBe(1);
    expect(tr.onOsc("D", ["0"])).toBeUndefined(); // ya cerrado
  });

  it("preserves a leading space in the raw command text", () => {
    const t = new FakeTerm();
    const tr = new BlockTracker(t);
    runCommand(t, tr, " secret-cmd", ["x"]);
    const b = tr.blocks()[0];
    expect(tr.commandText(b)).toBe("secret-cmd");
    expect(tr.commandText(b, false)).toBe(" secret-cmd");
  });

  it("defaults exit code to 0 when missing or invalid", () => {
    const t = new FakeTerm();
    const tr = new BlockTracker(t);
    t.write("$"); tr.onOsc("A"); tr.onOsc("B"); t.write("out"); tr.onOsc("C");
    const b = tr.onOsc("D", ["abc"]);
    expect(b?.exitCode).toBe(0);
  });

  it("replaces a prompt that never executed instead of accumulating", () => {
    const t = new FakeTerm();
    const tr = new BlockTracker(t);
    t.write("$"); tr.onOsc("A"); tr.onOsc("B");
    t.write("$"); tr.onOsc("A"); tr.onOsc("B");
    t.write("$"); tr.onOsc("A");
    expect(tr.blocks()).toHaveLength(1);
  });

  it("survives scrollback trimming and drops discarded blocks", () => {
    const t = new FakeTerm();
    const tr = new BlockTracker(t);
    runCommand(t, tr, "one", ["1"]);
    runCommand(t, tr, "two", ["2a", "2b"]);
    expect(tr.blocks()).toHaveLength(2);
    t.trim(3); // descarta el primer bloque entero (prompt + salida)
    const blocks = tr.blocks();
    expect(blocks).toHaveLength(1);
    expect(tr.commandText(blocks[0])).toBe("two");
    expect(tr.outputText(blocks[0])).toBe("2a\n2b");
    t.trim(100);
    expect(tr.blocks()).toHaveLength(0);
    expect(tr.hasBlocks()).toBe(false);
  });

  it("joins wrapped command lines without a newline", () => {
    const t = new FakeTerm();
    const tr = new BlockTracker(t);
    t.write("$ echo aaaa"); tr.onOsc("A"); t.cx = 2; tr.onOsc("B");
    t.write("bbbb", true);
    t.write("out"); tr.onOsc("C");
    t.write(""); tr.onOsc("D", ["0"]);
    expect(tr.commandText(tr.blocks()[0])).toBe("echo aaaabbbb");
  });

  it("limits the number of blocks", () => {
    const t = new FakeTerm();
    const tr = new BlockTracker(t, 3);
    for (let i = 0; i < 6; i++) runCommand(t, tr, `c${i}`, ["o"]);
    const cmds = tr.blocks().map((b) => tr.commandText(b));
    expect(cmds).toEqual(["c3", "c4", "c5"]);
  });

  it("resolves the block at a given line and its range", () => {
    const t = new FakeTerm();
    const tr = new BlockTracker(t);
    runCommand(t, tr, "one", ["1"]);
    runCommand(t, tr, "two", ["2a", "2b"]);
    const [a, b] = tr.blocks();
    expect(tr.blockAtLine(a.prompt.line)?.id).toBe(a.id);
    expect(tr.blockAtLine(b.prompt.line + 1)?.id).toBe(b.id);
    expect(tr.lineRange(b).start).toBe(b.prompt.line);
    expect(tr.blockAtLine(999)).toBeUndefined();
  });

  it("returns empty text when there is no shell integration data", () => {
    const t = new FakeTerm();
    const tr = new BlockTracker(t);
    expect(tr.blocks()).toEqual([]);
    t.write("$"); tr.onOsc("A");
    const b = tr.blocks()[0];
    expect(tr.commandText(b)).toBe("");
    expect(tr.outputText(b)).toBe("");
    expect(tr.executed()).toHaveLength(0);
  });

  it("dispose() releases every marker", () => {
    const t = new FakeTerm();
    const tr = new BlockTracker(t);
    runCommand(t, tr, "one", ["1"]);
    tr.dispose();
    expect(tr.blocks()).toHaveLength(0);
    expect(t.markers.every((m) => m.isDisposed)).toBe(true);
  });
});

describe("searchInRange", () => {
  it("only matches inside the given range", () => {
    const t = new FakeTerm();
    t.write("foo bar"); t.write("foo foo"); t.write("bar foo");
    const m = searchInRange(t, { start: 1, end: 1 }, "foo");
    expect(m).toEqual([
      { line: 1, col: 0, length: 3 },
      { line: 1, col: 4, length: 3 },
    ]);
  });

  it("is case-insensitive by default and supports case sensitivity", () => {
    const t = new FakeTerm();
    t.write("Foo");
    expect(searchInRange(t, { start: 0, end: 0 }, "foo")).toHaveLength(1);
    expect(searchInRange(t, { start: 0, end: 0 }, "foo", { caseSensitive: true })).toHaveLength(0);
    expect(searchInRange(t, { start: 0, end: 0 }, "")).toEqual([]);
  });
});

describe("formatDuration", () => {
  it("formats ms, seconds and minutes", () => {
    expect(formatDuration(undefined)).toBe("");
    expect(formatDuration(250)).toBe("250ms");
    expect(formatDuration(1500)).toBe("1.5s");
    expect(formatDuration(125000)).toBe("2m 5s");
  });
});
