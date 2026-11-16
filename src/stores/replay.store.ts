import { defineStore } from "pinia";
import { ReplayBuffer } from "../utils/replay-buffer";

/**
 * Registro de búferes de Instant Replay por panel (solo en memoria).
 * Se vacía al bloquear la bóveda y cada búfer se libera al cerrar su panel.
 */
export const useReplayStore = defineStore("replay", () => {
  const buffers = new Map<string, ReplayBuffer>();

  function bufferFor(paneId: string): ReplayBuffer {
    let b = buffers.get(paneId);
    if (!b) {
      b = new ReplayBuffer();
      buffers.set(paneId, b);
    }
    return b;
  }

  function get(paneId: string): ReplayBuffer | undefined {
    return buffers.get(paneId);
  }

  function release(paneId: string) {
    buffers.get(paneId)?.clear();
    buffers.delete(paneId);
  }

  /** Descarta el contenido de todos los paneles (bloqueo de bóveda o desactivación del ajuste). */
  function clearAll() {
    for (const b of buffers.values()) b.clear();
  }

  function paneCount() {
    return buffers.size;
  }

  return { bufferFor, get, release, clearAll, paneCount };
});
