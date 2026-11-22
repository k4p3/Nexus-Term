import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";

const svc = vi.hoisted(() => ({
  save: vi.fn(async (_j: string) => {}),
  get: vi.fn(async () => null as string | null),
  clear: vi.fn(async () => {}),
}));
vi.mock("../services/session-layout.service", () => ({ sessionLayoutService: svc }));
vi.mock("../services/session.service", () => ({ sessionService: { writeSession: vi.fn() } }));
vi.mock("../services/vault.service", () => ({ vaultService: { lock: vi.fn(), status: vi.fn(), unlock: vi.fn(), init: vi.fn() } }));
vi.mock("../services/inventory.service", () => ({ inventoryService: { getInventory: vi.fn() } }));
vi.mock("vue-i18n", async (orig) => ({ ...(await orig<typeof import("vue-i18n")>()), useI18n: () => ({ t: (k: string) => k }) }));

import { useSessionRestore, LAYOUT_SAVE_DEBOUNCE_MS } from "./useSessionRestore";
import { useSessionsStore } from "../stores/sessions.store";
import { useSettingsStore } from "../stores/settings.store";
import { useVaultStore } from "../stores/vault.store";
import { serializeLayout } from "../utils/session-layout";

const host = { id: "a", folder_id: null, jump_host_id: null, protocol: "ssh", label: "A", hostname: "h", port: 22,
  username_override: null, identity_id: null, tags: [], notes: null, updated_at: "x" } as const;

function stored() {
  const s = useSessionsStore();
  s.createTab("A", host as never);
  s.createTab("local");
  const json = JSON.stringify(serializeLayout(s.tabs, s.tabs[0].id));
  s.tabs.splice(0, 2);
  s.activeTabId = null;
  return json;
}

const flush = async () => { for (let i = 0; i < 6; i++) await nextTick(); await Promise.resolve(); };

describe("useSessionRestore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    Object.values(svc).forEach((f) => f.mockClear());
    svc.get.mockResolvedValue(null);
  });
  afterEach(() => vi.useRealTimers());

  function setup(mode: "ask" | "auto" | "off", layoutJson: string | null) {
    svc.get.mockResolvedValue(layoutJson);
    useSettingsStore().settings.restore_sessions = mode;
    const vault = useVaultStore();
    vault.fetchInventory = (async () => { vault.hosts = [host as never]; }) as never;
    const r = useSessionRestore();
    return { r, vault, sessions: useSessionsStore() };
  }

  it("ask: offers the dialog without restoring until confirmed", async () => {
    const json = stored();
    const { r, vault, sessions } = setup("ask", json);
    vault.isUnlocked = true;
    await flush();
    expect(r.pendingLayout.value?.tabs).toHaveLength(2);
    expect(r.pendingTabCount()).toBe(2);
    expect(sessions.tabs).toHaveLength(0);
    await r.confirmRestore();
    expect(sessions.tabs).toHaveLength(2);
    expect(r.pendingLayout.value).toBeNull();
  });

  it("ask: 'start empty' discards without restoring and then saves new state", async () => {
    const { r, vault, sessions } = setup("ask", stored());
    vault.isUnlocked = true;
    await flush();
    r.discardRestore();
    expect(sessions.tabs).toHaveLength(1); // descartar la oferta abre una terminal local
    sessions.createTab("new");
    await flush();
    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DEBOUNCE_MS + 10);
    expect(svc.save).toHaveBeenCalledTimes(1);
  });

  it("auto: restores directly without a dialog", async () => {
    const { r, vault, sessions } = setup("auto", stored());
    vault.isUnlocked = true;
    await flush();
    expect(r.pendingLayout.value).toBeNull();
    expect(sessions.tabs).toHaveLength(2);
  });

  it("off: restores nothing, saves nothing and clears any stored layout", async () => {
    const { r, vault, sessions } = setup("off", stored());
    vault.isUnlocked = true;
    await flush();
    expect(r.pendingLayout.value).toBeNull();
    expect(sessions.tabs).toHaveLength(1); // solo la terminal local inicial
    expect(svc.get).not.toHaveBeenCalled();
    expect(svc.clear).toHaveBeenCalled();
    sessions.createTab("x");
    await flush();
    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DEBOUNCE_MS + 10);
    expect(svc.save).not.toHaveBeenCalled();
  });

  it("does not ask when there is no saved layout", async () => {
    const { r, vault } = setup("ask", null);
    vault.isUnlocked = true;
    await flush();
    expect(r.pendingLayout.value).toBeNull();
  });

  it("never overwrites the stored layout before the startup decision", async () => {
    const { vault, sessions } = setup("ask", stored());
    vault.isUnlocked = true;
    await flush();
    sessions.createTab("opened-while-dialog-is-open");
    await flush();
    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DEBOUNCE_MS + 10);
    expect(svc.save).not.toHaveBeenCalled();
    expect(svc.clear).not.toHaveBeenCalled();
  });

  it("debounces saves into one call and stores only structural data", async () => {
    const { r, vault, sessions } = setup("auto", null);
    vault.isUnlocked = true;
    await flush();
    sessions.createTab("one");
    await flush();
    sessions.createTab("two");
    await flush();
    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DEBOUNCE_MS - 100);
    expect(svc.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(svc.save).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(svc.save.mock.calls[0][0]);
    expect(saved.tabs).toHaveLength(3); // local inicial + "one" + "two"
    void r;
  });

  it("clears the stored layout when every tab is closed", async () => {
    const { vault, sessions } = setup("auto", null);
    vault.isUnlocked = true;
    await flush();
    sessions.createTab("one");
    await flush();
    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DEBOUNCE_MS + 10);
    for (const tab of [...sessions.tabs]) sessions.closeTab(tab.id);
    await flush();
    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DEBOUNCE_MS + 10);
    expect(svc.clear).toHaveBeenCalled();
  });

  it("opens a local terminal when unlocking with nothing to restore", async () => {
    const { vault, sessions } = setup("ask", null);
    vault.isUnlocked = true;
    await flush();
    expect(sessions.tabs).toHaveLength(1);
  });

  it("does not add a local terminal when tabs are restored", async () => {
    const { vault, sessions } = setup("auto", stored());
    vault.isUnlocked = true;
    await flush();
    expect(sessions.tabs).toHaveLength(2);
  });

  it("does not reopen a local terminal after locking and unlocking", async () => {
    const { vault, sessions } = setup("auto", null);
    vault.isUnlocked = true;
    await flush();
    sessions.closeTab(sessions.tabs[0].id);
    vault.isUnlocked = false;
    await flush();
    vault.isUnlocked = true;
    await flush();
    expect(sessions.tabs).toHaveLength(0);
  });

  it("does not ask again after locking and unlocking in the same run", async () => {
    const { r, vault } = setup("ask", stored());
    vault.isUnlocked = true;
    await flush();
    r.discardRestore();
    vault.isUnlocked = false;
    await flush();
    svc.get.mockClear();
    vault.isUnlocked = true;
    await flush();
    expect(svc.get).not.toHaveBeenCalled();
    expect(r.pendingLayout.value).toBeNull();
  });
});

describe("useSessionRestore: lazy startup (vault locked)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    Object.values(svc).forEach((f) => f.mockClear());
    svc.get.mockResolvedValue(null);
  });
  afterEach(() => vi.useRealTimers());

  function localOnly() {
    const s = useSessionsStore();
    s.createTab("L1");
    s.createTab("L2");
    const json = JSON.stringify(serializeLayout(s.tabs, s.tabs[0].id));
    s.tabs.splice(0, 2);
    s.activeTabId = null;
    return json;
  }

  function setupLazy(mode: "ask" | "auto" | "off", layoutJson: string | null, askOnStartup = false) {
    svc.get.mockResolvedValue(layoutJson);
    const settings = useSettingsStore();
    settings.settings.restore_sessions = mode;
    settings.settings.ask_password_on_startup = askOnStartup;
    const vault = useVaultStore();
    const fetchInventory = vi.fn(async () => { vault.hosts = [host as never]; });
    vault.fetchInventory = fetchInventory as never;
    return { r: useSessionRestore(), vault, sessions: useSessionsStore(), fetchInventory };
  }

  it("opens an initial local tab without prompting when there is no saved layout", async () => {
    const { r, sessions } = setupLazy("ask", null);
    await r.startup();
    expect(sessions.tabs).toHaveLength(1);
    expect(sessions.tabs[0].rootPane).toMatchObject({ type: "leaf", hostId: undefined });
    expect(r.pendingLayout.value).toBeNull();
  });

  it("restores local-only layouts without unlocking or touching the inventory", async () => {
    const { r, sessions, fetchInventory } = setupLazy("auto", localOnly());
    await r.startup();
    expect(sessions.tabs.map((t) => t.title)).toEqual(["L1", "L2"]);
    expect(fetchInventory).not.toHaveBeenCalled();
  });

  it("asks about a local-only layout at startup and opens a local tab if discarded", async () => {
    const { r, sessions } = setupLazy("ask", localOnly());
    await r.startup();
    expect(r.pendingLayout.value?.tabs).toHaveLength(2);
    expect(sessions.tabs).toHaveLength(0);
    r.discardRestore();
    expect(sessions.tabs).toHaveLength(1);
  });

  it("defers a layout with hosts to the first unlock and never overwrites it before that", async () => {
    const { r, vault, sessions } = setupLazy("ask", stored());
    await r.startup();
    await flush();
    expect(r.pendingLayout.value).toBeNull(); // sin diálogo mientras está bloqueada
    expect(sessions.tabs).toHaveLength(1); // solo la terminal local inicial
    sessions.createTab("user-tab");
    await flush();
    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DEBOUNCE_MS + 10);
    expect(svc.save).not.toHaveBeenCalled();
    expect(svc.clear).not.toHaveBeenCalled();

    vault.isUnlocked = true; // primer desbloqueo
    await flush();
    // El usuario ya abrió una pestaña propia, así que no se ofrece restaurar encima (regla existente)
    expect(r.pendingLayout.value).toBeNull();
  });

  it("offers the deferred restore after unlock when only the initial local tab exists", async () => {
    const { r, vault, sessions } = setupLazy("ask", stored());
    await r.startup();
    vault.isUnlocked = true;
    await flush();
    expect(r.pendingLayout.value?.tabs).toHaveLength(2);
    expect(r.pendingInline.value).toBe(true); // oferta no modal tras un desbloqueo bajo demanda
    await r.confirmRestore();
    expect(r.pendingInline.value).toBe(false);
    expect(sessions.tabs).toHaveLength(3); // inicial + 2 restauradas
  });

  it("keeps the offer pending (and the stored layout intact) while the user ignores it", async () => {
    const { r, vault, sessions } = setupLazy("ask", stored());
    await r.startup();
    vault.isUnlocked = true;
    await flush();
    sessions.createTab("worked-meanwhile"); // el usuario sigue trabajando sin responder
    await flush();
    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DEBOUNCE_MS + 10);
    expect(r.pendingLayout.value).not.toBeNull();
    expect(svc.save).not.toHaveBeenCalled();
    expect(svc.clear).not.toHaveBeenCalled();
  });

  it("with 'ask password on startup' the offer stays a regular dialog", async () => {
    const { r, vault } = setupLazy("ask", stored(), true);
    await r.startup();
    vault.isUnlocked = true;
    await flush();
    expect(r.pendingLayout.value).not.toBeNull();
    expect(r.pendingInline.value).toBe(false);
  });

  it("auto mode restores the deferred layout right after the first unlock", async () => {
    const { vault, sessions } = setupLazy("auto", stored());
    await useSessionRestore().startup();
    vault.isUnlocked = true;
    await flush();
    expect(sessions.tabs).toHaveLength(3);
  });

  it("does nothing special when 'ask password on startup' is enabled", async () => {
    const { r, sessions } = setupLazy("ask", stored(), true);
    await r.startup();
    expect(sessions.tabs).toHaveLength(0);
    expect(svc.get).not.toHaveBeenCalled();
  });

  it("off: opens a local tab, clears the stored layout and saves nothing", async () => {
    const { r, sessions } = setupLazy("off", stored());
    await r.startup();
    expect(sessions.tabs).toHaveLength(1);
    expect(svc.clear).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DEBOUNCE_MS + 10);
    expect(svc.save).not.toHaveBeenCalled();
  });
});
