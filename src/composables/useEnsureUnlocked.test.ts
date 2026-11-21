import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("../services/vault.service", () => ({ vaultService: { lock: vi.fn(), status: vi.fn(), unlock: vi.fn(), init: vi.fn() } }));
vi.mock("../services/inventory.service", () => ({ inventoryService: { getInventory: vi.fn() } }));

import { useEnsureUnlocked, __resetEnsureUnlocked } from "./useEnsureUnlocked";
import { useVaultStore } from "../stores/vault.store";

describe("useEnsureUnlocked", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    __resetEnsureUnlocked();
  });

  it("resolves immediately without prompting when already unlocked", async () => {
    useVaultStore().isUnlocked = true;
    const { ensureUnlocked, promptOpen } = useEnsureUnlocked();
    expect(await ensureUnlocked()).toBe(true);
    expect(promptOpen.value).toBe(false);
  });

  it("opens the prompt when locked and resolves true once unlocked", async () => {
    const { ensureUnlocked, resolvePrompt, promptOpen } = useEnsureUnlocked();
    const p = ensureUnlocked();
    expect(promptOpen.value).toBe(true);
    resolvePrompt(true);
    expect(await p).toBe(true);
    expect(promptOpen.value).toBe(false);
  });

  it("resolves false when the user cancels", async () => {
    const { ensureUnlocked, resolvePrompt } = useEnsureUnlocked();
    const p = ensureUnlocked();
    resolvePrompt(false);
    expect(await p).toBe(false);
  });

  it("shares a single prompt between concurrent callers", async () => {
    const { ensureUnlocked, resolvePrompt } = useEnsureUnlocked();
    const a = ensureUnlocked();
    const b = ensureUnlocked();
    expect(a).toBe(b);
    resolvePrompt(true);
    expect(await Promise.all([a, b])).toEqual([true, true]);
  });

  it("can prompt again after a previous prompt finished", async () => {
    const { ensureUnlocked, resolvePrompt, promptOpen } = useEnsureUnlocked();
    const first = ensureUnlocked();
    resolvePrompt(false);
    await first;
    const second = ensureUnlocked();
    expect(promptOpen.value).toBe(true);
    resolvePrompt(true);
    expect(await second).toBe(true);
  });

  describe("runWithUnlock", () => {
    it("runs the action directly when unlocked", async () => {
      useVaultStore().isUnlocked = true;
      const { runWithUnlock } = useEnsureUnlocked();
      const fn = vi.fn(async () => "ok");
      expect(await runWithUnlock(fn)).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("prompts first when locked and runs the action after unlocking", async () => {
      const vault = useVaultStore();
      const { runWithUnlock, resolvePrompt, promptOpen } = useEnsureUnlocked();
      const fn = vi.fn(async () => "connected");
      const p = runWithUnlock(fn);
      expect(promptOpen.value).toBe(true);
      expect(fn).not.toHaveBeenCalled();
      vault.isUnlocked = true;
      resolvePrompt(true);
      expect(await p).toBe("connected");
    });

    it("does not run the action when the user cancels", async () => {
      const { runWithUnlock, resolvePrompt } = useEnsureUnlocked();
      const fn = vi.fn(async () => "x");
      const p = runWithUnlock(fn);
      resolvePrompt(false);
      expect(await p).toBeUndefined();
      expect(fn).not.toHaveBeenCalled();
    });

    it("retries once after a VAULT_LOCKED error (e.g. auto-lock fired in between)", async () => {
      const vault = useVaultStore();
      vault.isUnlocked = true;
      const { runWithUnlock, resolvePrompt, promptOpen } = useEnsureUnlocked();
      const fn = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce("Vault error: VAULT_LOCKED: Vault is currently locked.")
        .mockResolvedValueOnce("ok");
      const p = runWithUnlock(fn);
      await Promise.resolve();
      await Promise.resolve();
      expect(promptOpen.value).toBe(true);
      expect(vault.isUnlocked).toBe(false); // estado local corregido según el backend
      vault.isUnlocked = true;
      resolvePrompt(true);
      expect(await p).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("rethrows errors that are not about a locked vault", async () => {
      useVaultStore().isUnlocked = true;
      const { runWithUnlock } = useEnsureUnlocked();
      await expect(runWithUnlock(async () => { throw "Connection refused"; })).rejects.toBe("Connection refused");
    });
  });
});
