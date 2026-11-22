import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("../services/history.service", () => ({
  historyService: { search: vi.fn(async () => []), record: vi.fn(), remove: vi.fn(), clear: vi.fn() },
}));
vi.mock("../services/snippets.service", () => ({
  snippetsService: { getSnippets: vi.fn(async () => []), saveSnippet: vi.fn(), toggleSnippetEnabled: vi.fn(), deleteSnippet: vi.fn() },
}));

import { useInlineSuggestion, type InlineTerm } from "./useInlineSuggestion";
import { useHistoryStore } from "../stores/history.store";
import { useSettingsStore } from "../stores/settings.store";

function setup(over: { alt?: boolean; selection?: boolean; line?: { text: string; atEnd: boolean } | null; blocked?: boolean } = {}) {
  setActivePinia(createPinia());
  const history = useHistoryStore();
  history.entries = [{ id: "1", host_id: "local", command: "git checkout main", use_count: 1, last_exit_code: 0, last_used_at: "x" }];
  history.loadedHost = "local";
  const rendered: string[] = [];
  const decorations: { dispose: ReturnType<typeof vi.fn> }[] = [];
  const term: InlineTerm = {
    cols: 80,
    buffer: { active: { type: over.alt ? "alternate" : "normal", cursorX: 8 } },
    hasSelection: () => !!over.selection,
    registerMarker: () => ({ id: 1, line: 0, isDisposed: false, onDispose: () => ({ dispose() {} }), dispose: vi.fn() }),
    registerDecoration: () => {
      const d = {
        dispose: vi.fn(),
        onRender(cb: (el: HTMLElement) => void) {
          const el = document.createElement("div");
          cb(el);
          rendered.push(el.textContent ?? "");
        },
      };
      decorations.push(d);
      return d;
    },
  };
  const insert = vi.fn();
  const api = useInlineSuggestion({
    getTerm: () => term,
    getLine: () => (over.line === undefined ? { text: "git ch", atEnd: true } : over.line),
    hostId: () => null,
    isBlocked: () => !!over.blocked,
    insert,
  });
  return { api, insert, rendered, decorations };
}

describe("useInlineSuggestion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the suffix as a decoration", () => {
    const { api, rendered } = setup();
    api.compute();
    expect(api.suffix.value).toBe("eckout main");
    expect(rendered).toEqual(["eckout main"]);
  });

  it("does not repaint when nothing changed", () => {
    const { api, decorations } = setup();
    api.compute();
    api.compute();
    expect(decorations).toHaveLength(1);
  });

  it.each([
    ["alternate screen", { alt: true }],
    ["active selection", { selection: true }],
    ["popup open", { blocked: true }],
    ["no OSC 133 line", { line: null }],
    ["cursor not at end", { line: { text: "git ch", atEnd: false } }],
  ])("shows nothing with %s", (_n, over) => {
    const { api, rendered } = setup(over);
    api.compute();
    expect(api.suffix.value).toBe("");
    expect(rendered).toHaveLength(0);
  });

  it("shows nothing when the setting is off", () => {
    const { api } = setup();
    useSettingsStore().settings.inline_suggestion = false;
    api.compute();
    expect(api.suffix.value).toBe("");
  });

  it("accepts the whole suffix with ArrowRight and End and clears it", () => {
    for (const key of ["ArrowRight", "End"]) {
      const { api, insert } = setup();
      api.compute();
      expect(api.handleKey({ key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false })).toBe(true);
      expect(insert).toHaveBeenCalledWith("eckout main");
      expect(api.suffix.value).toBe("");
    }
  });

  it("accepts one word with Ctrl+ArrowRight", () => {
    const { api, insert } = setup();
    api.compute();
    expect(api.handleKey({ key: "ArrowRight", ctrlKey: true, altKey: false, metaKey: false, shiftKey: false })).toBe(true);
    expect(insert).toHaveBeenCalledWith("eckout");
  });

  it("leaves other keys and modifiers alone, and everything when nothing is shown", () => {
    const { api, insert } = setup();
    api.compute();
    const k = (key: string, o = {}) => ({ key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...o });
    expect(api.handleKey(k("Enter"))).toBe(false);
    expect(api.handleKey(k("Tab"))).toBe(false);
    expect(api.handleKey(k("ArrowRight", { shiftKey: true }))).toBe(false);
    expect(api.handleKey(k("ArrowRight", { altKey: true }))).toBe(false);
    api.clear();
    expect(api.handleKey(k("ArrowRight"))).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("clear disposes the decoration", () => {
    const { api, decorations } = setup();
    api.compute();
    api.clear();
    expect(decorations[0].dispose).toHaveBeenCalled();
  });
});
