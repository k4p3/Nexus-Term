import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("../services/vault.service", () => ({
  vaultService: { lock: vi.fn(async () => {}), status: vi.fn(), unlock: vi.fn(), init: vi.fn() },
}));
vi.mock("../services/inventory.service", () => ({ inventoryService: { getInventory: vi.fn() } }));

import { useVaultStore } from "./vault.store";
import { usePasteHistoryStore } from "./paste-history.store";

describe("vault lock", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("discards the in-memory paste history when the vault is locked", async () => {
    const paste = usePasteHistoryStore();
    paste.add("-----BEGIN OPENSSH PRIVATE KEY-----", 20);
    const vault = useVaultStore();
    vault.isUnlocked = true;
    await vault.lock();
    expect(vault.isUnlocked).toBe(false);
    expect(paste.entries).toEqual([]);
  });
});

describe("vault lock keeps open sessions", () => {
  it("does not close or modify tabs and sessions when locking", async () => {
    const { useSessionsStore } = await import("./sessions.store");
    const sessions = useSessionsStore();
    sessions.createTab("local");
    const before = JSON.stringify(sessions.tabs);
    const vault = useVaultStore();
    vault.isUnlocked = true;
    await vault.lock();
    expect(vault.isUnlocked).toBe(false);
    expect(sessions.tabs).toHaveLength(1);
    expect(JSON.stringify(sessions.tabs)).toBe(before);
  });
});
