import { ref } from "vue";
import type { Terminal } from "@xterm/xterm";
import { buildHints, resolveLabel, type Hint } from "../utils/quick-select";

export interface QuickSelectResult {
  text: string;
  paste: boolean;
}

/** Lee las líneas visibles del viewport (sin alterar el buffer). */
export function readViewportLines(term: Terminal): string[] {
  const buf = term.buffer.active;
  const lines: string[] = [];
  for (let row = 0; row < term.rows; row++) {
    lines.push(buf.getLine(buf.viewportY + row)?.translateToString(true) ?? "");
  }
  return lines;
}

/**
 * Modo Quick Select: resalta coincidencias del viewport y resuelve la etiqueta tecleada.
 * Mientras está activo, `handleKey` consume TODAS las teclas (no llegan al PTY).
 */
export function useQuickSelect(
  getTerm: () => Terminal | null,
  getContainer: () => HTMLElement | null,
  onResult: (r: QuickSelectResult) => void,
  onEmpty: () => void,
) {
  const active = ref(false);
  const hints = ref<Hint[]>([]);
  const typed = ref("");
  const metrics = ref({ cellW: 0, cellH: 0, originX: 0, originY: 0 });

  function start() {
    const term = getTerm();
    const container = getContainer();
    if (!term || !container) return;
    const found = buildHints(readViewportLines(term));
    if (found.length === 0) {
      onEmpty();
      return;
    }
    const screen = term.element?.querySelector<HTMLElement>(".xterm-screen");
    const sr = screen?.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    if (!sr || !sr.width || !sr.height) return;
    metrics.value = {
      cellW: sr.width / term.cols,
      cellH: sr.height / term.rows,
      originX: sr.left - cr.left,
      originY: sr.top - cr.top,
    };
    hints.value = found;
    typed.value = "";
    active.value = true;
  }

  function cancel() {
    active.value = false;
    hints.value = [];
    typed.value = "";
  }

  /** Devuelve `true` si la tecla fue consumida (siempre mientras el modo está activo). */
  function handleKey(e: KeyboardEvent): boolean {
    if (!active.value) return false;
    e.preventDefault();
    e.stopPropagation();
    if (e.type !== "keydown") return true;
    if (e.key === "Escape") {
      cancel();
      return true;
    }
    if (e.key === "Backspace") {
      typed.value = typed.value.slice(0, -1);
      return true;
    }
    if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1 || !/[a-zA-Z]/.test(e.key)) return true;

    const next = typed.value + e.key;
    const res = resolveLabel(next, hints.value);
    if (res.state === "match") {
      const { hint, paste } = res;
      cancel();
      onResult({ text: hint.text, paste });
    } else if (res.state === "prefix") {
      typed.value = next;
    } else {
      typed.value = "";
    }
    return true;
  }

  return { active, hints, typed, metrics, start, cancel, handleKey };
}
