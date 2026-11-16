import { defineStore } from "pinia";
import { ref } from "vue";

export interface PasteEntry {
  id: number;
  text: string;
  at: number;
}

/**
 * Historial de pegado SOLO en memoria: nunca se guarda en localStorage ni en disco.
 * Se vacía al bloquear la bóveda y al cerrar la aplicación.
 */
export const usePasteHistoryStore = defineStore("paste-history", () => {
  const entries = ref<PasteEntry[]>([]);
  let nextId = 1;

  function add(text: string, max: number) {
    if (!text || max <= 0) return;
    // Evita duplicados consecutivos y mueve al frente si ya existía.
    entries.value = entries.value.filter((e) => e.text !== text);
    entries.value.unshift({ id: nextId++, text, at: Date.now() });
    if (entries.value.length > max) entries.value.length = max;
  }

  /** Aplica un nuevo límite (p. ej. si el usuario lo reduce en ajustes). */
  function trim(max: number) {
    if (entries.value.length > max) entries.value.length = Math.max(0, max);
  }

  function remove(id: number) {
    entries.value = entries.value.filter((e) => e.id !== id);
  }

  function clear() {
    entries.value = [];
  }

  return { entries, add, trim, remove, clear };
});
