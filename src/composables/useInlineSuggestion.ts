import { ref } from "vue";
import { useHistoryStore } from "../stores/history.store";
import { useSnippetsStore } from "../stores/snippets.store";
import { useSettingsStore } from "../stores/settings.store";
import { historyHostKey } from "../utils/history-filter";
import { suggestFor, nextWord, type InputLine } from "../utils/inline-suggestion";
import type { MarkerLike } from "../utils/command-blocks";

interface DecorationLike {
  dispose(): void;
  onRender(cb: (el: HTMLElement) => void): unknown;
}

/** Parte mínima de xterm que necesita la sugerencia en línea. */
export interface InlineTerm {
  readonly cols: number;
  readonly buffer: { readonly active: { readonly type: string; readonly cursorX: number } };
  hasSelection(): boolean;
  registerMarker(cursorYOffset?: number): MarkerLike | undefined;
  registerDecoration(opts: { marker: MarkerLike; x: number; width: number }): DecorationLike | undefined;
}

export interface InlineOptions {
  getTerm: () => InlineTerm | null;
  /** Lee la línea de entrada de la pantalla (o `null` si no se está en un prompt con OSC 133). */
  getLine: () => InputLine | null;
  hostId: () => string | null | undefined;
  /** Otro elemento (p. ej. el popup) tiene prioridad: no se muestra nada. */
  isBlocked: () => boolean;
  /** Inserta texto en el prompt sin ejecutarlo. */
  insert: (text: string) => void;
}

type KeyLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "metaKey" | "shiftKey">;

/**
 * Sugerencia en gris tras el cursor. Se pinta como decoración de xterm y solo vive en memoria;
 * aceptarla (→, End, Ctrl+→) inserta texto, nunca ejecuta.
 */
export function useInlineSuggestion(opts: InlineOptions) {
  const history = useHistoryStore();
  const snippets = useSnippetsStore();
  const settings = useSettingsStore();

  const suffix = ref("");
  let decoration: DecorationLike | null = null;
  let marker: MarkerLike | null = null;
  let shownKey = "";
  let frame = 0;
  let snippetsRequested = false;

  function removeDecoration() {
    decoration?.dispose();
    marker?.dispose();
    decoration = null;
    marker = null;
    shownKey = "";
  }

  function clear() {
    suffix.value = "";
    removeDecoration();
  }

  function paint(term: InlineTerm, text: string) {
    const x = term.buffer.active.cursorX;
    const width = Math.min(text.length, term.cols - x);
    const key = `${x}|${text}`;
    if (width <= 0) return removeDecoration();
    if (key === shownKey && decoration) return;
    removeDecoration();
    marker = term.registerMarker(0) ?? null;
    if (!marker) return;
    decoration = term.registerDecoration({ marker, x, width }) ?? null;
    shownKey = key;
    const shown = text.slice(0, width);
    decoration?.onRender((el) => {
      el.textContent = shown;
      Object.assign(el.style, {
        color: "var(--theme-fg-muted, #888)", opacity: "0.6", whiteSpace: "pre",
        overflow: "hidden", pointerEvents: "none",
      });
    });
  }

  /** Recalcula la sugerencia y la pinta (o la oculta). */
  function compute() {
    frame = 0;
    const term = opts.getTerm();
    if (!term || !settings.settings.inline_suggestion || opts.isBlocked() || term.buffer.active.type === "alternate" || term.hasSelection()) {
      return clear();
    }
    const line = opts.getLine();
    if (!line || !line.atEnd) return clear();

    const key = historyHostKey(opts.hostId());
    if (settings.settings.history_enabled && history.loadedHost !== key) {
      history.loadedHost = key; // evita relanzar la carga mientras llega
      void history.load(opts.hostId()).then(schedule);
    }
    if (!snippetsRequested && snippets.snippets.length === 0) {
      snippetsRequested = true;
      void snippets.fetchSnippets().then(schedule, () => {});
    }

    const s = suggestFor(line.text, history.entries, snippets.enabledSnippets, settings.settings.history_enabled);
    if (!s) return clear();
    suffix.value = s;
    paint(term, s);
  }

  /** Un único recálculo por frame. */
  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(compute);
  }

  /** Procesa una tecla. Devuelve `true` si se consumió (no debe llegar al shell). */
  function handleKey(e: KeyLike): boolean {
    if (!suffix.value || e.altKey || e.metaKey || e.shiftKey) return false;
    let text = "";
    if (!e.ctrlKey && (e.key === "ArrowRight" || e.key === "End")) text = suffix.value;
    else if (e.ctrlKey && e.key === "ArrowRight") text = nextWord(suffix.value);
    else return false;
    if (!text) return false;
    clear();
    opts.insert(text);
    return true;
  }

  function dispose() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    clear();
  }

  return { suffix, compute, schedule, clear, handleKey, dispose };
}
