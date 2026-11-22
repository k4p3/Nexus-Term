import { defineStore } from "pinia";
import { ref } from "vue";
import type { HistoryEntry } from "../types/history";
import { historyService } from "../services/history.service";
import { shouldRecordCommand, historyHostKey } from "../utils/history-filter";

export const HISTORY_FETCH_LIMIT = 2000;
/** Máximo de comandos retenidos en memoria mientras la bóveda está bloqueada. */
export const HISTORY_PENDING_LIMIT = 200;

interface PendingCommand {
  hostKey: string;
  command: string;
  exitCode: number | null;
  at: string;
}

/** Historial de comandos por host. El texto vive cifrado en la bóveda; aquí solo hay una caché en memoria. */
export const useHistoryStore = defineStore("history", () => {
  const entries = ref<HistoryEntry[]>([]);
  const loadedHost = ref<string | null>(null);
  /** Comandos terminados con la bóveda bloqueada: solo en memoria, nunca a disco sin cifrar. */
  const pending = ref<PendingCommand[]>([]);

  function pendingFor(key: string): HistoryEntry[] {
    const seen = new Map<string, HistoryEntry>();
    pending.value.forEach((p, i) => {
      if (p.hostKey !== key) return;
      const prev = seen.get(p.command);
      seen.set(p.command, {
        id: `pending:${i}`,
        host_id: p.hostKey,
        command: p.command,
        use_count: (prev?.use_count ?? 0) + 1,
        last_exit_code: p.exitCode,
        last_used_at: p.at,
      });
    });
    return [...seen.values()].reverse();
  }

  /** Registra un comando finalizado. Aplica las exclusiones de seguridad; los errores se ignoran. */
  async function record(
    hostId: string | null | undefined,
    command: string,
    exitCode: number | null | undefined,
    enabled: boolean,
  ): Promise<boolean> {
    if (!enabled || !shouldRecordCommand(command)) return false;
    const hostKey = historyHostKey(hostId);
    const text = command.replace(/[\r\n]+$/u, "");
    try {
      await historyService.record(hostKey, text, exitCode);
      if (loadedHost.value === hostKey) loadedHost.value = null; // la caché ya no incluye este comando
      return true;
    } catch {
      // Bóveda bloqueada (u otro fallo): se retiene en memoria hasta el desbloqueo.
      pending.value.push({ hostKey, command: text, exitCode: exitCode ?? null, at: new Date().toISOString() });
      if (pending.value.length > HISTORY_PENDING_LIMIT) pending.value.splice(0, pending.value.length - HISTORY_PENDING_LIMIT);
      if (loadedHost.value === hostKey) entries.value = [...pendingFor(hostKey), ...entries.value.filter((e) => !e.id.startsWith("pending:"))];
      return false;
    }
  }

  async function load(hostId: string | null | undefined) {
    const key = historyHostKey(hostId);
    try {
      const stored = await historyService.search(key, null, HISTORY_FETCH_LIMIT);
      entries.value = [...pendingFor(key), ...stored];
    } catch {
      entries.value = pendingFor(key);
    }
    loadedHost.value = key;
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

  /** Vuelca en orden los comandos retenidos (al desbloquear). Los que fallan se descartan. */
  async function flushPending(): Promise<void> {
    const queued = pending.value;
    pending.value = [];
    for (const p of queued) {
      try {
        await historyService.record(p.hostKey, p.command, p.exitCode);
      } catch {
        /* el historial es opcional */
      }
    }
    entries.value = entries.value.filter((e) => !e.id.startsWith("pending:"));
    loadedHost.value = null;
  }

  /** Descarta la caché (al bloquear la bóveda). La cola pendiente se conserva. */
  function reset() {
    entries.value = [];
    loadedHost.value = null;
  }

  return { entries, loadedHost, pending, record, load, remove, clear, reset, flushPending };
});
