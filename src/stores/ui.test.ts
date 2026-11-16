import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useUiStore, TOAST_TTL_MS } from "./ui.store";
import { usePasteHistoryStore } from "./paste-history.store";

describe("ui store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("pushes toasts, auto-dismisses them and caps the list", () => {
    const ui = useUiStore();
    const id = ui.pushToast("hola");
    expect(ui.toasts).toHaveLength(1);
    vi.advanceTimersByTime(TOAST_TTL_MS + 1);
    expect(ui.toasts.find((t) => t.id === id)).toBeUndefined();
    for (let i = 0; i < 6; i++) ui.pushToast(`t${i}`);
    expect(ui.toasts).toHaveLength(4);
    expect(ui.toasts[0].message).toBe("t2");
  });

  it("dismisses a toast manually", () => {
    const ui = useUiStore();
    const id = ui.pushToast("x", { kind: "warning" });
    ui.dismissToast(id);
    expect(ui.toasts).toEqual([]);
  });

  it("runs registered pane actions and reports missing ones", () => {
    const ui = useUiStore();
    const fn = vi.fn();
    ui.registerPaneActions("p1", { search: fn });
    expect(ui.runPaneAction("p1", "search")).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(ui.runPaneAction("p1", "quickSelect")).toBe(false);
    expect(ui.runPaneAction("nope", "search")).toBe(false);
    expect(ui.runPaneAction(null, "search")).toBe(false);
    ui.unregisterPaneActions("p1");
    expect(ui.runPaneAction("p1", "search")).toBe(false);
  });

  it("remembers the notified pane only while the notice is recent", () => {
    const ui = useUiStore();
    ui.markNotified("t1", "p1", 1000);
    expect(ui.consumeNotified(1000 + 59_000)).toEqual({ tabId: "t1", paneId: "p1", at: 1000 });
    expect(ui.consumeNotified(1000 + 59_000)).toBeNull(); // se consume una vez
    ui.markNotified("t1", "p1", 1000);
    expect(ui.consumeNotified(1000 + 61_000)).toBeNull();
  });

  it("requests quick connect with an optional prefill", () => {
    const ui = useUiStore();
    ui.openQuickConnect("10.0.0.5");
    expect(ui.quickConnectPrefill).toBe("10.0.0.5");
    expect(ui.quickConnectRequest).toBe(1);
    ui.openQuickConnect();
    expect(ui.quickConnectPrefill).toBeNull();
    expect(ui.quickConnectRequest).toBe(2);
  });
});

describe("paste history store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("keeps the newest first, deduplicates and honours the limit", () => {
    const h = usePasteHistoryStore();
    h.add("a", 3);
    h.add("b", 3);
    h.add("a", 3);
    expect(h.entries.map((e) => e.text)).toEqual(["a", "b"]);
    h.add("c", 3);
    h.add("d", 3);
    expect(h.entries.map((e) => e.text)).toEqual(["d", "c", "a"]);
  });

  it("ignores empty text and a zero limit", () => {
    const h = usePasteHistoryStore();
    h.add("", 5);
    h.add("x", 0);
    expect(h.entries).toEqual([]);
  });

  it("trims, removes and clears", () => {
    const h = usePasteHistoryStore();
    ["a", "b", "c"].forEach((t) => h.add(t, 10));
    h.trim(2);
    expect(h.entries).toHaveLength(2);
    h.remove(h.entries[0].id);
    expect(h.entries).toHaveLength(1);
    h.clear();
    expect(h.entries).toEqual([]);
  });

  it("never touches browser storage", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    usePasteHistoryStore().add("secreto", 5);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
