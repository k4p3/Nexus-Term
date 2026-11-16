import { defineStore } from "pinia";
import { ref } from "vue";

export type TerminalActionId =
  | "search"
  | "quickSelect"
  | "pasteHistory"
  | "prevPrompt"
  | "nextPrompt"
  | "splitH"
  | "splitV"
  | "closePane"
  | "copyLastOutput"
  | "rerunBlock"
  | "history"
  | "instantReplay"
  | "copyBlockCommand";

export type PaneActions = Partial<Record<TerminalActionId, () => void>>;

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "success" | "warning";
  /** Si se indica, "Ir" activa esa pestaña/panel. */
  tabId?: string;
  paneId?: string;
}

export const TOAST_TTL_MS = 6000;

export const useUiStore = defineStore("ui", () => {
  const toasts = ref<Toast[]>([]);
  const paletteOpen = ref(false);
  const shortcutsOpen = ref(false);
  /** Texto con el que abrir el Quick Connect (p. ej. una IP detectada en la terminal). */
  const quickConnectPrefill = ref<string | null>(null);
  const quickConnectRequest = ref(0);
  const paneActions = ref<Record<string, PaneActions>>({});
  /** Último panel notificado por el sistema: al recuperar el foco, la ventana lo activa. */
  const lastNotified = ref<{ tabId: string; paneId: string; at: number } | null>(null);
  let nextToastId = 1;

  function pushToast(message: string, opts: Partial<Omit<Toast, "id" | "message">> = {}): number {
    const toast: Toast = { id: nextToastId++, message, kind: "info", ...opts };
    toasts.value.push(toast);
    // Máximo 4 avisos visibles
    if (toasts.value.length > 4) toasts.value.shift();
    setTimeout(() => dismissToast(toast.id), TOAST_TTL_MS);
    return toast.id;
  }

  function dismissToast(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function openQuickConnect(prefill?: string) {
    quickConnectPrefill.value = prefill ?? null;
    quickConnectRequest.value++;
  }

  function registerPaneActions(paneId: string, actions: PaneActions) {
    paneActions.value[paneId] = actions;
  }

  function unregisterPaneActions(paneId: string) {
    delete paneActions.value[paneId];
  }

  /** Ejecuta una acción de terminal sobre un panel. Devuelve `false` si no existe o no aplica. */
  function runPaneAction(paneId: string | null | undefined, action: TerminalActionId): boolean {
    const fn = paneId ? paneActions.value[paneId]?.[action] : undefined;
    if (!fn) return false;
    fn();
    return true;
  }

  function markNotified(tabId: string, paneId: string, now = Date.now()) {
    lastNotified.value = { tabId, paneId, at: now };
  }

  /** Devuelve (y olvida) el panel notificado si el aviso es reciente. */
  function consumeNotified(now = Date.now(), maxAgeMs = 60_000) {
    const n = lastNotified.value;
    lastNotified.value = null;
    return n && now - n.at <= maxAgeMs ? n : null;
  }

  return {
    lastNotified,
    markNotified,
    consumeNotified,
    toasts,
    paletteOpen,
    shortcutsOpen,
    quickConnectPrefill,
    quickConnectRequest,
    paneActions,
    pushToast,
    dismissToast,
    openQuickConnect,
    registerPaneActions,
    unregisterPaneActions,
    runPaneAction,
  };
});
