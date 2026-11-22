import { ref, shallowRef } from "vue";
import { LineBuffer } from "../utils/line-buffer";
import { buildCandidates, type Candidate } from "../utils/completion-candidates";
import { anchorPopup, type PopupAnchor } from "../utils/popup-anchor";
import { useHistoryStore } from "../stores/history.store";
import { useSnippetsStore } from "../stores/snippets.store";
import { useSettingsStore } from "../stores/settings.store";

export const AUTOCOMPLETE_MAX_ROWS = 8;
const POPUP_WIDTH = 480;
const POPUP_ROW_HEIGHT = 28;
const POPUP_FOOTER = 26;
const CANDIDATE_LIMIT = 50;

/** Parte mínima de xterm que necesita el autocompletado. */
export interface AutocompleteTerm {
  readonly cols: number;
  readonly rows: number;
  readonly element?: HTMLElement | null;
  readonly buffer: { readonly active: { readonly type: string; readonly cursorX: number; readonly cursorY: number } };
}

export interface AutocompleteOptions {
  getTerm: () => AutocompleteTerm | null;
  hostId: () => string | null | undefined;
  /**
   * Inserta `text` en el prompt. Con `replace` se borra antes lo escrito (Ctrl+U).
   * Devuelve `true` si se insertó de inmediato (si necesita confirmación devuelve `false`).
   */
  insert: (text: string, replace: boolean) => boolean;
}

/**
 * Popup de autocompletado: sigue la línea actual con `LineBuffer` y la cruza con el historial del host
 * y los snippets. No ejecuta nada: aceptar solo inserta texto.
 */
export function useAutocomplete(opts: AutocompleteOptions) {
  const history = useHistoryStore();
  const snippets = useSnippetsStore();
  const settings = useSettingsStore();

  const buffer = new LineBuffer();
  const isOpen = ref(false);
  const index = ref(0);
  const candidates = shallowRef<Candidate[]>([]);
  const anchor = ref<PopupAnchor>({ left: 0, top: 0, above: false });
  let openToken = 0;

  function isAlternateScreen(): boolean {
    return opts.getTerm()?.buffer.active.type === "alternate";
  }

  function query(): string {
    return buffer.reliable ? buffer.text : "";
  }

  function refresh() {
    candidates.value = buildCandidates(history.entries, snippets.enabledSnippets, query(), {
      historyEnabled: settings.settings.history_enabled,
      limit: CANDIDATE_LIMIT,
    });
    index.value = 0;
  }

  function updateAnchor() {
    const term = opts.getTerm();
    const screen = term?.element?.querySelector<HTMLElement>(".xterm-screen")?.getBoundingClientRect();
    if (!term || !screen) return;
    const rows = Math.min(candidates.value.length || 1, AUTOCOMPLETE_MAX_ROWS);
    anchor.value = anchorPopup(
      {
        screen: { left: screen.left, top: screen.top, width: screen.width, height: screen.height },
        cols: term.cols,
        rows: term.rows,
        cursorX: term.buffer.active.cursorX,
        cursorY: term.buffer.active.cursorY,
      },
      { width: POPUP_WIDTH, height: rows * POPUP_ROW_HEIGHT + POPUP_FOOTER },
      { width: window.innerWidth, height: window.innerHeight },
    );
  }

  function close() {
    openToken++;
    isOpen.value = false;
    candidates.value = [];
  }

  async function open(): Promise<boolean> {
    if (isAlternateScreen()) return false;
    const token = ++openToken;
    isOpen.value = true;
    if (settings.settings.history_enabled) await history.load(opts.hostId());
    if (snippets.snippets.length === 0) {
      try {
        await snippets.fetchSnippets();
      } catch {
        /* los snippets son opcionales */
      }
    }
    if (token !== openToken) return false; // se cerró (o reabrió) mientras se cargaba
    refresh();
    updateAnchor();
    return true;
  }

  async function toggle(): Promise<void> {
    if (isOpen.value) close();
    else await open();
  }

  /** Alimenta el seguimiento de la línea con lo enviado al shell y refresca el popup. */
  function onInput(data: string) {
    const wasReliable = buffer.reliable;
    buffer.feed(data);
    if (!isOpen.value) return;
    if (/[\r\n\x03]/u.test(data) || (wasReliable && !buffer.reliable)) {
      close();
      return;
    }
    refresh();
    updateAnchor();
  }

  function accept(candidate?: Candidate): boolean {
    const c = candidate ?? candidates.value[index.value];
    if (!c) return false;
    const multiline = /[\r\n]/u.test(c.text);
    const replace = buffer.reliable && buffer.text.length > 0 && !multiline;
    close();
    const inserted = opts.insert(c.text, replace);
    // Insertar entra por `onData` como texto pegado; se restablece la línea que ahora hay.
    if (inserted && !multiline && (replace || (buffer.reliable && buffer.text.length === 0))) buffer.set(c.text);
    return true;
  }

  /** Procesa una tecla con el popup abierto. Devuelve `true` si se consumió (no debe llegar al shell). */
  function handleKey(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "metaKey" | "shiftKey">): boolean {
    if (!isOpen.value) return false;
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return false;
    const n = candidates.value.length;
    switch (e.key) {
      case "Escape":
        close();
        return true;
      case "ArrowDown":
        if (n === 0) return false;
        index.value = Math.min(index.value + 1, n - 1);
        return true;
      case "ArrowUp":
        if (n === 0) return false;
        index.value = Math.max(index.value - 1, 0);
        return true;
      case "Tab":
        if (n === 0) {
          close(); // sin sugerencias, Tab es del shell
          return false;
        }
        return accept();
      default:
        return false;
    }
  }

  return { buffer, isOpen, index, candidates, anchor, isAlternateScreen, open, close, toggle, onInput, accept, handleKey };
}
