import { ref, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useSessionsStore } from "../stores/sessions.store";
import { useSettingsStore } from "../stores/settings.store";
import { useVaultStore } from "../stores/vault.store";
import { useUiStore } from "../stores/ui.store";
import { sessionLayoutService } from "../services/session-layout.service";
import {
  serializeLayout, parseLayout, decideRestoreAction, layoutTabCount, layoutHasHostLeaf, type SessionLayout,
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
  /** Oferta no modal: se usa cuando el desbloqueo fue bajo demanda, para no apilar un diálogo sobre el de la contraseña. */
  const pendingInline = ref(false);
  let startupResolved = false;
  /** Arranque con la bóveda bloqueada: se abre una terminal local inicial. */
  let lazyStart = false;
  let initialTabId: string | null = null;
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

  function openInitialLocalTab() {
    if (lazyStart && sessions.tabs.length === 0) initialTabId = sessions.createTab(t("terminal.newLocal"));
  }

  async function applyRestore(layout: SessionLayout) {
    if (vault.isUnlocked) await vault.fetchInventory(); // los hosts deben estar cargados para resolver los IDs
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
    // La terminal local inicial (aún sin restaurar nada) no cuenta como "pestaña abierta por el usuario".
    const openTabs = sessions.tabs.filter((tab) => tab.id !== initialTabId).length;
    const action = decideRestoreAction(mode(), layout, openTabs);
    if (action === "prompt" && layout) {
      pendingInline.value = lazyStart; // tras un desbloqueo bajo demanda se ofrece sin bloquear la pantalla
      pendingLayout.value = layout; // la oferta resuelve el inicio
      return;
    }
    if (action === "auto" && layout) await applyRestore(layout);
    startupResolved = true;
    schedule();
  }

  /**
   * Arranque sin desbloquear la bóveda: abre una terminal local y restaura lo que no necesita la bóveda.
   * Si el layout guardado contiene hosts, la restauración se aplaza al primer desbloqueo y NO se guarda
   * nada hasta entonces, para no pisar el layout almacenado con un estado parcial.
   */
  async function startup() {
    if (vault.isUnlocked || settings.settings.ask_password_on_startup) return;
    lazyStart = true;
    let layout: SessionLayout | null = null;
    if (mode() !== "off") {
      try {
        layout = parseLayout(await sessionLayoutService.get());
      } catch {
        layout = null;
      }
    } else {
      sessionLayoutService.clear().catch(() => {});
    }
    if (layoutTabCount(layout) === 0) {
      startupResolved = true;
      openInitialLocalTab();
      schedule();
      return;
    }
    if (layoutHasHostLeaf(layout)) {
      openInitialLocalTab(); // la restauración queda pendiente del primer desbloqueo
      return;
    }
    const action = decideRestoreAction(mode(), layout, 0);
    if (action === "prompt" && layout) {
      pendingLayout.value = layout;
      return;
    }
    if (action === "auto" && layout) await applyRestore(layout);
    startupResolved = true;
    openInitialLocalTab();
    schedule();
  }

  async function confirmRestore() {
    const layout = pendingLayout.value;
    pendingLayout.value = null;
    pendingInline.value = false;
    if (layout) await applyRestore(layout);
    startupResolved = true;
    openInitialLocalTab();
    schedule();
  }

  function discardRestore() {
    pendingLayout.value = null;
    pendingInline.value = false;
    startupResolved = true;
    openInitialLocalTab();
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

  return { startup, pendingLayout, pendingInline, pendingTabCount: () => layoutTabCount(pendingLayout.value), confirmRestore, discardRestore };
}
