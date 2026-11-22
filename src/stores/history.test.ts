import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const svc = vi.hoisted(() => ({
  record: vi.fn(async () => {}),
  search: vi.fn(async () => [] as unknown[]),
  remove: vi.fn(async () => {}),
  clear: vi.fn(async () => 3),
}));
vi.mock("../services/history.service", () => ({ historyService: svc }));
vi.mock("../services/vault.service", () => ({
  vaultService: { lock: vi.fn(async () => {}), status: vi.fn(), unlock: vi.fn(), init: vi.fn() },
}));
vi.mock("../services/inventory.service", () => ({ inventoryService: { getInventory: vi.fn() } }));

import { useHistoryStore } from "./history.store";
import { useVaultStore } from "./vault.store";

const entry = (id: string, command: string) => ({
  id, host_id: "h1", command, use_count: 1, last_exit_code: 0, last_used_at: "2026-01-01",
});

describe("history store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    Object.values(svc).forEach((f) => f.mockClear());
  });

  it("records valid commands under the host key and strips the trailing newline", async () => {
    const s = useHistoryStore();
    expect(await s.record("h1", "ls -la\n", 0, true)).toBe(true);
    expect(svc.record).toHaveBeenCalledWith("h1", "ls -la", 0);
  });

  it("uses 'local' for shells without a host", async () => {
    const s = useHistoryStore();
    await s.record(undefined, "htop", null, true);
    expect(svc.record).toHaveBeenCalledWith("local", "htop", null);
  });

  it("records nothing when disabled", async () => {
    const s = useHistoryStore();
    expect(await s.record("h1", "ls", 0, false)).toBe(false);
    expect(svc.record).not.toHaveBeenCalled();
  });

  it("filters excluded commands before reaching the backend", async () => {
    const s = useHistoryStore();
    for (const c of [" ls", "mysql --password=x", "export API_KEY=1", "   "]) {
      expect(await s.record("h1", c, 0, true)).toBe(false);
    }
    expect(svc.record).not.toHaveBeenCalled();
  });

  it("swallows backend errors (e.g. locked vault)", async () => {
    svc.record.mockRejectedValueOnce("locked");
    const s = useHistoryStore();
    expect(await s.record("h1", "ls", 0, true)).toBe(false);
  });

  it("loads, removes and clears entries", async () => {
    svc.search.mockResolvedValueOnce([entry("1", "a"), entry("2", "b")]);
    const s = useHistoryStore();
    await s.load("h1");
    expect(svc.search).toHaveBeenCalledWith("h1", null, 2000);
    expect(s.entries).toHaveLength(2);
    await s.remove("1");
    expect(s.entries.map((e) => e.id)).toEqual(["2"]);
    expect(await s.clear("h1")).toBe(3);
    expect(svc.clear).toHaveBeenCalledWith("h1");
    expect(s.entries).toEqual([]);
  });

  it("clearing everything passes no host id", async () => {
    const s = useHistoryStore();
    await s.clear();
    expect(svc.clear).toHaveBeenCalledWith(null);
  });

  it("load failure leaves an empty cache (only pending entries, none here)", async () => {
    svc.search.mockRejectedValueOnce("locked");
    const s = useHistoryStore();
    await s.load("h1");
    expect(s.entries).toEqual([]);
  });

  it("discards the cache when the vault is locked", async () => {
    svc.search.mockResolvedValueOnce([entry("1", "secret-ish")]);
    const s = useHistoryStore();
    await s.load("h1");
    const vault = useVaultStore();
    vault.isUnlocked = true;
    await vault.lock();
    expect(s.entries).toEqual([]);
  });

  describe("pending queue while the vault is locked", () => {
    it("queues commands in memory when recording fails and exposes them in load()", async () => {
      const s = useHistoryStore();
      svc.record.mockRejectedValueOnce("locked");
      expect(await s.record("h1", "ls -la", 0, true)).toBe(false);
      svc.search.mockRejectedValueOnce("locked");
      await s.load("h1");
      expect(s.entries.map((e) => e.command)).toEqual(["ls -la"]);
    });

    it("does not queue excluded or disabled commands", async () => {
      const s = useHistoryStore();
      svc.record.mockRejectedValue("locked");
      await s.record("h1", "export TOKEN=abc123secret", 0, true);
      await s.record("h1", "ls", 0, false);
      expect(s.pending).toHaveLength(0);
      svc.record.mockReset();
      svc.record.mockImplementation(async () => {});
    });

    it("caps the queue at 200 keeping the newest", async () => {
      const s = useHistoryStore();
      svc.record.mockRejectedValue("locked");
      for (let i = 0; i < 205; i++) await s.record("h1", `cmd${i}`, 0, true);
      expect(s.pending).toHaveLength(200);
      expect(s.pending[0].command).toBe("cmd5");
      svc.record.mockReset();
      svc.record.mockImplementation(async () => {});
    });

    it("flushes in order on demand, empties the queue and keeps it on reset()", async () => {
      const s = useHistoryStore();
      svc.record.mockRejectedValueOnce("locked").mockRejectedValueOnce("locked");
      await s.record("h1", "first", 0, true);
      await s.record("h2", "second", 1, true);
      s.reset();
      expect(s.pending).toHaveLength(2);
      svc.record.mockClear();
      await s.flushPending();
      expect((svc.record.mock.calls as unknown as unknown[][]).map((c) => c[1])).toEqual(["first", "second"]);
      expect(s.pending).toHaveLength(0);
    });

    it("never writes the queue anywhere except the encrypted service", async () => {
      const spy = vi.spyOn(Storage.prototype, "setItem");
      const s = useHistoryStore();
      svc.record.mockRejectedValueOnce("locked");
      await s.record("h1", "ls", 0, true);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
