import { defineStore } from "pinia";
import { ref } from "vue";
import type { HistoryEntry } from "../types/history";
import { historyService } from "../services/history.service";
import { shouldRecordCommand, historyHostKey } from "../utils/history-filter";

export const HISTORY_FETCH_LIMIT = 2000;

/** Historial de comandos por host. El texto vive cifrado en la bóveda; aquí solo hay una caché en memoria. */
export const useHistoryStore = defineStore("history", () => {
  const entries = ref<HistoryEntry[]>([]);
  const loadedHost = ref<string | null>(null);

  /** Registra un comando finalizado. Aplica las exclusiones de seguridad; los errores se ignoran. */
  async function record(
    hostId: string | null | undefined,
    command: string,
    exitCode: number | null | undefined,
    enabled: boolean,
  ): Promise<boolean> {
    if (!enabled || !shouldRecordCommand(command)) return false;
    try {
      await historyService.record(historyHostKey(hostId), command.replace(/[\r\n]+$/u, ""), exitCode);
      return true;
    } catch {
      return false; // bóveda bloqueada u otro fallo: el historial es opcional
    }
  }

  async function load(hostId: string | null | undefined) {
    const key = historyHostKey(hostId);
    try {
      entries.value = await historyService.search(key, null, HISTORY_FETCH_LIMIT);
      loadedHost.value = key;
    } catch {
      entries.value = [];
      loadedHost.value = null;
    }
  }

  async function remove(id: string) {
    await historyService.remove(id);
    entries.value = entries.value.filter((e) => e.id !== id);
  }

  /** Borra el historial de un host, o todo si `hostId` es `undefined`. */
  async function clear(hostId?: string | null): Promise<number> {
    const n = await historyService.clear(hostId === undefined ? null : historyHostKey(hostId));
    if (hostId === undefined || loadedHost.value === historyHostKey(hostId)) entries.value = [];
    return n;
  }

  /** Descarta la caché (al bloquear la bóveda). */
  function reset() {
    entries.value = [];
    loadedHost.value = null;
  }

  return { entries, loadedHost, record, load, remove, clear, reset };
});
