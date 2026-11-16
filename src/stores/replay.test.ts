import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("../services/vault.service", () => ({
  vaultService: { lock: vi.fn(async () => {}), status: vi.fn(), unlock: vi.fn(), init: vi.fn() },
}));
vi.mock("../services/inventory.service", () => ({ inventoryService: { getInventory: vi.fn() } }));

import { useReplayStore } from "./replay.store";
import { useVaultStore } from "./vault.store";

describe("replay store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("returns the same buffer per pane and distinct buffers across panes", () => {
    const s = useReplayStore();
    expect(s.bufferFor("a")).toBe(s.bufferFor("a"));
    expect(s.bufferFor("a")).not.toBe(s.bufferFor("b"));
    expect(s.get("zzz")).toBeUndefined();
  });

  it("release() clears and forgets the pane buffer", () => {
    const s = useReplayStore();
    const b = s.bufferFor("a");
    b.push(1, new Uint8Array([1]));
    s.release("a");
    expect(b.span).toBeNull();
    expect(s.get("a")).toBeUndefined();
    expect(s.paneCount()).toBe(0);
  });

  it("clearAll() empties every buffer but keeps the panes", () => {
    const s = useReplayStore();
    s.bufferFor("a").push(1, new Uint8Array([1]));
    s.bufferFor("b").push(1, new Uint8Array([1]));
    s.clearAll();
    expect(s.bufferFor("a").span).toBeNull();
    expect(s.bufferFor("b").span).toBeNull();
    expect(s.paneCount()).toBe(2);
  });

  it("is wiped when the vault is locked", async () => {
    const s = useReplayStore();
    s.bufferFor("a").push(1, new Uint8Array([1, 2, 3]));
    const vault = useVaultStore();
    vault.isUnlocked = true;
    await vault.lock();
    expect(s.bufferFor("a").span).toBeNull();
  });
});
