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
