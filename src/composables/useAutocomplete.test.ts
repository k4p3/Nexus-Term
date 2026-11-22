import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const svc = vi.hoisted(() => ({
  search: vi.fn(async () => [] as unknown[]),
  getSnippets: vi.fn(async () => [] as unknown[]),
}));
vi.mock("../services/history.service", () => ({ historyService: { search: svc.search, record: vi.fn(), remove: vi.fn(), clear: vi.fn() } }));
vi.mock("../services/snippets.service", () => ({ snippetsService: { getSnippets: svc.getSnippets } }));

import { useAutocomplete, type AutocompleteTerm } from "./useAutocomplete";
import { useSettingsStore } from "../stores/settings.store";

const entry = (id: string, command: string) =>
  ({ id, host_id: "local", command, use_count: 1, last_exit_code: 0, last_used_at: "2026-01-01T00:00:00Z" });
const key = (k: string, o: object = {}) => ({ key: k, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...o });
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

function setup(type = "normal") {
  const term: AutocompleteTerm = { cols: 80, rows: 24, element: null, buffer: { active: { type, cursorX: 0, cursorY: 0 } } };
  const insert = vi.fn((_text: string, _replace: boolean) => true);
  const ac = useAutocomplete({ getTerm: () => term, hostId: () => null, insert });
  return { ac, insert, term };
}
const typeText = (ac: ReturnType<typeof setup>["ac"], s: string) => { for (const ch of s) ac.onInput(ch); };

describe("useAutocomplete", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    svc.search.mockReset().mockResolvedValue([entry("1", "git checkout main"), entry("2", "git status"), entry("3", "ls -la")]);
    svc.getSnippets.mockReset().mockResolvedValue([
      { id: "s1", title: "Disk", command_template: "df -h", is_enabled: true, is_builtin: false },
    ]);
  });

  it("opens with candidates filtered by what has been typed", async () => {
    const { ac } = setup();
    typeText(ac, "git ch");
    await ac.open();
    expect(ac.isOpen.value).toBe(true);
    expect(ac.candidates.value.map((c) => c.text)).toEqual(["git checkout main"]);
  });

  it("refines the list while typing and keeps the selection at the top", async () => {
    const { ac } = setup();
    await ac.open();
    expect(ac.candidates.value.length).toBe(4);
    typeText(ac, "ls");
    expect(ac.candidates.value.map((c) => c.text)).toEqual(["ls -la"]);
    expect(ac.index.value).toBe(0);
  });

  it("lists unfiltered recent entries when the line is unreliable", async () => {
    const { ac } = setup();
    typeText(ac, "git");
    ac.onInput("\x1b[A");
    await ac.open();
    expect(ac.candidates.value.length).toBe(4);
  });

  it("closes the popup when the line becomes unreliable while open", async () => {
    const { ac } = setup();
    typeText(ac, "g");
    await ac.open();
    ac.onInput("\x1b[D");
    expect(ac.isOpen.value).toBe(false);
  });

  it("closes on Enter and Ctrl+C", async () => {
    for (const k of ["\r", "\x03"]) {
      const { ac } = setup();
      await ac.open();
      ac.onInput(k);
      expect(ac.isOpen.value).toBe(false);
    }
  });

  it("does not open on the alternate screen", async () => {
    const { ac } = setup("alternate");
    expect(ac.isAlternateScreen()).toBe(true);
    expect(await ac.open()).toBe(false);
    expect(ac.isOpen.value).toBe(false);
  });

  it("only offers snippets when history is disabled", async () => {
    const { ac } = setup();
    useSettingsStore().settings.history_enabled = false;
    await ac.open();
    expect(ac.candidates.value.map((c) => c.id)).toEqual(["s:s1"]);
    expect(svc.search).not.toHaveBeenCalled();
  });

  it("navigates with arrows without leaving the list", async () => {
    const { ac } = setup();
    await ac.open();
    expect(ac.handleKey(key("ArrowUp"))).toBe(true);
    expect(ac.index.value).toBe(0);
    ac.handleKey(key("ArrowDown")); ac.handleKey(key("ArrowDown"));
    expect(ac.index.value).toBe(2);
    for (let i = 0; i < 10; i++) ac.handleKey(key("ArrowDown"));
    expect(ac.index.value).toBe(3);
  });

  it("Escape closes and is consumed; Enter and other keys are never consumed", async () => {
    const { ac } = setup();
    await ac.open();
    expect(ac.handleKey(key("Enter"))).toBe(false);
    expect(ac.handleKey(key("a"))).toBe(false);
    expect(ac.handleKey(key("ArrowDown", { shiftKey: true }))).toBe(false);
    expect(ac.handleKey(key("Escape"))).toBe(true);
    expect(ac.isOpen.value).toBe(false);
    expect(ac.handleKey(key("Escape"))).toBe(false);
  });

  it("Tab accepts the selection replacing the typed text, without executing", async () => {
    const { ac, insert } = setup();
    typeText(ac, "git ch");
    await ac.open();
    expect(ac.handleKey(key("Tab"))).toBe(true);
    expect(insert).toHaveBeenCalledWith("git checkout main", true);
    expect(insert.mock.calls.every(([text]) => !text.includes("\r"))).toBe(true);
    expect(ac.isOpen.value).toBe(false);
    expect(ac.buffer.text).toBe("git checkout main");
    expect(ac.buffer.reliable).toBe(true);
  });

  it("accepting with an unreliable line inserts without replacing", async () => {
    const { ac, insert } = setup();
    ac.onInput("\t");
    await ac.open();
    ac.accept(ac.candidates.value[1]);
    expect(insert).toHaveBeenCalledWith("git status", false);
    expect(ac.buffer.reliable).toBe(false);
  });

  it("accepting on an empty prompt inserts without erasing and tracks the new line", async () => {
    const { ac, insert } = setup();
    await ac.open();
    ac.handleKey(key("Tab"));
    expect(insert).toHaveBeenCalledWith("git checkout main", false);
    expect(ac.buffer.text).toBe("git checkout main");
  });

  it("inserts snippets as written, never executing them", async () => {
    const { ac, insert } = setup();
    typeText(ac, "disk");
    await ac.open();
    ac.accept();
    expect(insert).toHaveBeenCalledWith("df -h", true);
  });

  it("does not erase the line for multi-line candidates", async () => {
    svc.getSnippets.mockResolvedValue([{ id: "m", title: "Multi", command_template: "a\nb", is_enabled: true, is_builtin: false }]);
    const { ac, insert } = setup();
    typeText(ac, "mul");
    await ac.open();
    ac.accept();
    expect(insert).toHaveBeenCalledWith("a\nb", false);
  });

  it("Tab with no suggestions closes the popup and is left to the shell", async () => {
    const { ac } = setup();
    typeText(ac, "zzzz");
    await ac.open();
    expect(ac.candidates.value).toHaveLength(0);
    expect(ac.handleKey(key("Tab"))).toBe(false);
    expect(ac.isOpen.value).toBe(false);
  });

  it("toggle closes when open", async () => {
    const { ac } = setup();
    await ac.toggle();
    expect(ac.isOpen.value).toBe(true);
    await ac.toggle();
    expect(ac.isOpen.value).toBe(false);
  });

  it("ignores a late load when closed in the meantime", async () => {
    const { ac } = setup();
    const p = ac.open();
    ac.close();
    await p;
    await flush();
    expect(ac.isOpen.value).toBe(false);
    expect(ac.candidates.value).toEqual([]);
  });
});
