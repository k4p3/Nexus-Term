import { invoke } from "@tauri-apps/api/core";
import type { HistoryEntry } from "../types/history";

export const historyService = {
  async record(hostId: string, command: string, exitCode?: number | null): Promise<void> {
    await invoke("history_record", { hostId, command, exitCode: exitCode ?? null });
  },
  async search(hostId: string, query: string | null, limit: number): Promise<HistoryEntry[]> {
    return await invoke<HistoryEntry[]>("history_search", { hostId, query, limit });
  },
  async remove(id: string): Promise<void> {
    await invoke("history_delete", { id });
  },
  /** Borra el historial de un host, o todo si no se indica. Devuelve las filas eliminadas. */
  async clear(hostId?: string | null): Promise<number> {
    return await invoke<number>("history_clear", { hostId: hostId ?? null });
  },
};
