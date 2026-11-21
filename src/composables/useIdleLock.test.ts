import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { effectScope, nextTick } from "vue";

const lockSvc = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../services/vault.service", () => ({ vaultService: { lock: lockSvc, status: vi.fn(), unlock: vi.fn(), init: vi.fn() } }));
vi.mock("../services/inventory.service", () => ({ inventoryService: { getInventory: vi.fn() } }));

import { useIdleLock } from "./useIdleLock";
import { useSettingsStore } from "../stores/settings.store";
import { useVaultStore } from "../stores/vault.store";

const MIN = 60_000;

describe("useIdleLock", () => {
  let scope: ReturnType<typeof effectScope>;

  function setup(opts: { enabled?: boolean; minutes?: number; unlocked?: boolean } = {}) {
    const settings = useSettingsStore();
    settings.settings.auto_lock_enabled = opts.enabled ?? true;
    settings.settings.auto_lock_minutes = opts.minutes ?? 10;
    useVaultStore().isUnlocked = opts.unlocked ?? true;
    scope = effectScope();
    scope.run(() => useIdleLock());
  }

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    lockSvc.mockClear();
  });
  afterEach(() => {
    scope?.stop();
    vi.useRealTimers();
  });

  it("locks the vault after the configured minutes without user input", async () => {
    setup({ minutes: 10 });
    vi.advanceTimersByTime(10 * MIN - 1);
    expect(lockSvc).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(lockSvc).toHaveBeenCalledTimes(1);
  });

  it("user input postpones the lock", () => {
    setup({ minutes: 10 });
    vi.advanceTimersByTime(9 * MIN);
    window.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(9 * MIN);
    expect(lockSvc).not.toHaveBeenCalled();
    vi.advanceTimersByTime(MIN);
    expect(lockSvc).toHaveBeenCalledTimes(1);
  });

  it("throttles bursts of events but still counts activity after the throttle window", () => {
    setup({ minutes: 1 });
    vi.advanceTimersByTime(30_000);
    window.dispatchEvent(new Event("pointermove"));
    vi.advanceTimersByTime(59_000);
    expect(lockSvc).not.toHaveBeenCalled();
  });

  it("does nothing when auto-lock is disabled", () => {
    setup({ enabled: false });
    vi.advanceTimersByTime(60 * MIN);
    expect(lockSvc).not.toHaveBeenCalled();
  });

  it("does nothing while the vault is already locked", () => {
    setup({ unlocked: false });
    vi.advanceTimersByTime(60 * MIN);
    expect(lockSvc).not.toHaveBeenCalled();
  });

  it("starts counting once the vault gets unlocked", async () => {
    setup({ unlocked: false, minutes: 5 });
    useVaultStore().isUnlocked = true;
    await nextTick();
    vi.advanceTimersByTime(5 * MIN);
    expect(lockSvc).toHaveBeenCalledTimes(1);
  });

  it("applies a new duration without restart and stops when disabled", async () => {
    setup({ minutes: 10 });
    const settings = useSettingsStore();
    settings.settings.auto_lock_minutes = 2;
    await nextTick();
    vi.advanceTimersByTime(2 * MIN);
    expect(lockSvc).toHaveBeenCalledTimes(1);
  });

  it("stops listening when disabled at runtime", async () => {
    setup({ minutes: 1 });
    useSettingsStore().settings.auto_lock_enabled = false;
    await nextTick();
    vi.advanceTimersByTime(5 * MIN);
    expect(lockSvc).not.toHaveBeenCalled();
  });

  it("stops everything when the scope is disposed", () => {
    setup({ minutes: 1 });
    scope.stop();
    vi.advanceTimersByTime(5 * MIN);
    expect(lockSvc).not.toHaveBeenCalled();
  });
});
