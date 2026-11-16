import { ref, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useSessionsStore } from "../stores/sessions.store";
import { useSettingsStore } from "../stores/settings.store";
import { useVaultStore } from "../stores/vault.store";
import { useUiStore } from "../stores/ui.store";
import { sessionLayoutService } from "../services/session-layout.service";
import {
  serializeLayout, parseLayout, decideRestoreAction, layoutTabCount, type SessionLayout,
} from "../utils/session-layout";

export const LAYOUT_SAVE_DEBOUNCE_MS = 1000;

/**
 * Guarda el layout de pestañas/paneles (con debounce) y ofrece restaurarlo tras desbloquear la bóveda.
 * No guarda nada hasta resolver la decisión inicial, para no pisar el layout previo con un espacio vacío.
 */
export function useSessionRestore() {
  const { t } = useI18n();
  const sessions = useSessionsStore();
  const settings = useSettingsStore();
  const vault = useVaultStore();
  const ui = useUiStore();

  const pendingLayout = ref<SessionLayout | null>(null);
  let startupResolved = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const mode = () => settings.settings.restore_sessions;

  async function persist() {
    timer = null;
    if (!startupResolved || mode() === "off") return;
    try {
      if (sessions.tabs.length === 0) await sessionLayoutService.clear();
      else await sessionLayoutService.save(JSON.stringify(serializeLayout(sessions.tabs, sessions.activeTabId)));
    } catch {
      /* el layout es opcional: un fallo no debe interrumpir al usuario */
    }
  }

  function schedule() {
    if (!startupResolved || mode() === "off") return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(persist, LAYOUT_SAVE_DEBOUNCE_MS);
  }

  async function applyRestore(layout: SessionLayout) {
    await vault.fetchInventory(); // los hosts deben estar cargados para resolver los IDs
    const { skipped } = sessions.restoreLayout(layout, vault.hosts);
    if (skipped.length > 0) ui.pushToast(t("restore.skipped", { n: skipped.length, names: skipped.slice(0, 3).join(", ") }), { kind: "warning" });
  }

  async function onUnlocked() {
    if (startupResolved) return; // bloquear y desbloquear no debe volver a preguntar
    let layout: SessionLayout | null = null;
    if (mode() !== "off") {
      try {
        layout = parseLayout(await sessionLayoutService.get());
      } catch {
        layout = null;
      }
    } else {
      sessionLayoutService.clear().catch(() => {}); // modo desactivado: no se conserva nada
    }
    const action = decideRestoreAction(mode(), layout, sessions.tabs.length);
    if (action === "prompt" && layout) {
      pendingLayout.value = layout; // el diálogo resuelve el inicio
      return;
    }
    if (action === "auto" && layout) await applyRestore(layout);
    startupResolved = true;
    schedule();
  }

  async function confirmRestore() {
    const layout = pendingLayout.value;
    pendingLayout.value = null;
    if (layout) await applyRestore(layout);
    startupResolved = true;
    schedule();
  }

  function discardRestore() {
    pendingLayout.value = null;
    startupResolved = true;
    schedule();
  }

  watch(() => vault.isUnlocked, (u) => { if (u) void onUnlocked(); }, { immediate: true });
  watch(() => JSON.stringify(serializeLayout(sessions.tabs, sessions.activeTabId)), schedule);
  watch(mode, (m) => {
    if (m === "off") {
      if (timer) clearTimeout(timer);
      sessionLayoutService.clear().catch(() => {});
    } else {
      schedule();
    }
  });
  onUnmounted(() => { if (timer) clearTimeout(timer); });

  return { pendingLayout, pendingTabCount: () => layoutTabCount(pendingLayout.value), confirmRestore, discardRestore };
}
