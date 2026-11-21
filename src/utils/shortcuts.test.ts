import { describe, it, expect } from "vitest";
import { SHORTCUTS, comboMatches, findConflicts, formatShortcut, matchShortcut, type ShortcutDef } from "./shortcuts";

const ev = (o: Partial<KeyboardEvent> & { key: string }) =>
  ({ code: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...o }) as KeyboardEvent;

describe("shortcut registry", () => {
  it("has no conflicting combinations in overlapping contexts", () => {
    expect(findConflicts()).toEqual([]);
  });

  it("detects conflicts when they exist", () => {
    const a: ShortcutDef = { id: "a", combo: { key: "x", ctrl: true }, context: "global", titleKey: "a", group: "tools" };
    const b: ShortcutDef = { ...a, id: "b", context: "terminal" };
    expect(findConflicts([a, b])).toEqual([["a", "b"]]);
    expect(findConflicts([{ ...a, context: "terminal" }, { ...b, context: "workspace" }])).toEqual([]);
  });

  it("never registers a plain Ctrl+letter (reserved for the shell) except the existing globals", () => {
    const allowedPlain = new Set(["app.quickConnect", "app.toggleSidebar", "app.settings", "terminal.search",
      // Teclas no imprimibles que el shell no usa: cambio de pestaña.
      "app.nextTab", "app.nextTabAlt", "app.prevTabAlt"]);
    for (const d of SHORTCUTS) {
      const c = d.combo;
      if (c.ctrl && !c.shift && !c.alt && !allowedPlain.has(d.id)) {
        throw new Error(`Atajo simple Ctrl+${c.key ?? c.code} no permitido: ${d.id}`);
      }
    }
  });

  it("matches shortcuts by key, code and modifiers", () => {
    expect(matchShortcut(ev({ key: "P", ctrlKey: true, shiftKey: true }))?.id).toBe("terminal.palette");
    expect(matchShortcut(ev({ key: " ", code: "Space", ctrlKey: true, shiftKey: true }))?.id).toBe("terminal.quickSelect");
    expect(matchShortcut(ev({ key: "?", code: "Slash", ctrlKey: true, shiftKey: true }))?.id).toBe("app.shortcuts");
    expect(matchShortcut(ev({ key: "v", ctrlKey: true, altKey: true }))?.id).toBe("terminal.pasteHistory");
    expect(matchShortcut(ev({ key: "k", metaKey: true }))?.id).toBe("app.quickConnect");
    expect(matchShortcut(ev({ key: "H", ctrlKey: true, shiftKey: true }))?.id).toBe("terminal.history");
    expect(matchShortcut(ev({ key: "y", ctrlKey: true, shiftKey: true }))?.id).toBe("terminal.instantReplay");
    expect(matchShortcut(ev({ key: "R", ctrlKey: true, shiftKey: true }))?.id).toBe("terminal.rerunBlock");
  });

  it("resolves Ctrl+Shift+T to a new local terminal in the global context", () => {
    expect(matchShortcut(ev({ key: "T", ctrlKey: true, shiftKey: true }), ["global", "workspace"])?.id).toBe("terminal.newLocal");
    expect(matchShortcut(ev({ key: "t", metaKey: true, shiftKey: true }), ["global"])?.id).toBe("terminal.newLocal");
    expect(matchShortcut(ev({ key: "t", ctrlKey: true }))).toBeNull();
  });

  it("resolves tab switching combos and keeps them apart from pane focus", () => {
    const k = (o: Partial<KeyboardEvent>) => ev({ key: "", ...o });
    expect(matchShortcut(k({ code: "Tab", key: "Tab", ctrlKey: true }))?.id).toBe("app.nextTab");
    expect(matchShortcut(k({ code: "Tab", key: "Tab", ctrlKey: true, shiftKey: true }))?.id).toBe("app.prevTab");
    expect(matchShortcut(k({ code: "PageDown", key: "PageDown", ctrlKey: true }))?.id).toBe("app.nextTabAlt");
    expect(matchShortcut(k({ code: "PageUp", key: "PageUp", ctrlKey: true }))?.id).toBe("app.prevTabAlt");
    expect(matchShortcut(k({ code: "Tab", key: "Tab" }))).toBeNull();
    expect(matchShortcut(ev({ key: "ArrowLeft", altKey: true }), ["terminal"])?.id).toBe("terminal.focusLeft");
  });

  it("does not match with extra or missing modifiers", () => {
    expect(matchShortcut(ev({ key: "p", ctrlKey: true }))).toBeNull();
    expect(matchShortcut(ev({ key: "p", ctrlKey: true, shiftKey: true, altKey: true }))).toBeNull();
    expect(matchShortcut(ev({ key: "p" }))).toBeNull();
  });

  it("ignores native shortcuts (copy/paste) and respects contexts", () => {
    expect(matchShortcut(ev({ key: "c", ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(matchShortcut(ev({ key: "p", ctrlKey: true, shiftKey: true }), ["global"])).toBeNull();
    expect(matchShortcut(ev({ key: "p", ctrlKey: true, shiftKey: true }), ["global", "workspace"])?.id).toBe("terminal.palette");
    expect(matchShortcut(ev({ key: "o", ctrlKey: true, shiftKey: true }), ["global", "workspace"])).toBeNull();
    expect(matchShortcut(ev({ key: "k", ctrlKey: true }), ["terminal"])?.id).toBe("app.quickConnect");
  });

  it("comboMatches handles arrows", () => {
    expect(comboMatches({ key: "arrowup", ctrl: true, shift: true }, ev({ key: "ArrowUp", ctrlKey: true, shiftKey: true }))).toBe(true);
  });

  it("resolves Alt+arrows to pane focus without touching the Ctrl+Shift+arrows prompt shortcuts", () => {
    const alt = (key: string) => ev({ key, altKey: true });
    expect(matchShortcut(alt("ArrowLeft"), ["terminal"])?.id).toBe("terminal.focusLeft");
    expect(matchShortcut(alt("ArrowRight"), ["terminal"])?.id).toBe("terminal.focusRight");
    expect(matchShortcut(alt("ArrowUp"), ["terminal"])?.id).toBe("terminal.focusUp");
    expect(matchShortcut(alt("ArrowDown"), ["terminal"])?.id).toBe("terminal.focusDown");
    expect(matchShortcut(ev({ key: "ArrowUp", ctrlKey: true, shiftKey: true }), ["terminal"])?.id).toBe("terminal.prevPrompt");
    // arrows alone and Alt+Shift+arrows are left to the shell
    expect(matchShortcut(ev({ key: "ArrowLeft" }), ["terminal"])).toBeNull();
    expect(matchShortcut(ev({ key: "ArrowLeft", altKey: true, shiftKey: true }), ["terminal"])).toBeNull();
  });

  it("formats the pane focus shortcuts for docs", () => {
    const f = (id: string) => formatShortcut(SHORTCUTS.find((s) => s.id === id)!, "other");
    expect([f("terminal.focusLeft"), f("terminal.focusRight"), f("terminal.focusUp"), f("terminal.focusDown")]).toEqual([
      "Alt+←", "Alt+→", "Alt+↑", "Alt+↓",
    ]);
  });

  it("formats for Linux/Windows and macOS", () => {
    const p = SHORTCUTS.find((s) => s.id === "terminal.palette")!;
    expect(formatShortcut(p, "other")).toBe("Ctrl+Shift+P");
    expect(formatShortcut(p, "mac")).toBe("⌘⇧P");
    expect(formatShortcut(SHORTCUTS.find((s) => s.id === "terminal.quickSelect")!)).toBe("Ctrl+Shift+Space");
    expect(formatShortcut(SHORTCUTS.find((s) => s.id === "app.shortcuts")!)).toBe("Ctrl+Shift+/");
    expect(formatShortcut(SHORTCUTS.find((s) => s.id === "terminal.prevPrompt")!)).toBe("Ctrl+Shift+↑");
    expect(formatShortcut(SHORTCUTS.find((s) => s.id === "terminal.pasteHistory")!)).toBe("Ctrl+Alt+V");
    expect(formatShortcut(SHORTCUTS.find((s) => s.id === "terminal.history")!)).toBe("Ctrl+Shift+H");
    expect(formatShortcut(SHORTCUTS.find((s) => s.id === "terminal.history")!, "mac")).toBe("⌘⇧H");
  });

  it("every shortcut id is unique", () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
