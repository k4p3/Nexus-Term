import type { HistoryEntry } from "../types/history";
import { toCandidates, type SnippetLike } from "./completion-candidates";
import { hasSnippetParams } from "./snippet-params";
import type { BufferLineLike, MarkerLike } from "./command-blocks";

/** Mínimo de caracteres escritos antes de sugerir. */
export const MIN_PREFIX = 2;
/** Filas máximas que puede ocupar la entrada (líneas envueltas) para sugerir. */
export const MAX_INPUT_ROWS = 5;

export interface InputBlockLike {
  commandStart?: MarkerLike;
  commandStartX: number;
  outputStart?: MarkerLike;
}

export interface InputTermLike {
  readonly buffer: {
    readonly active: {
      readonly baseY: number;
      readonly cursorX: number;
      readonly cursorY: number;
      getLine(y: number): BufferLineLike | undefined;
    };
  };
}

export interface InputLine {
  /** Texto escrito entre el inicio de la entrada (OSC 133 B) y el cursor. */
  text: string;
  /** `true` si a la derecha del cursor no hay texto (el cursor está al final). */
  atEnd: boolean;
}

/**
 * Lee de la pantalla lo escrito en el prompt. Devuelve `null` si no se está en la entrada de un
 * comando (sin B, o ya con salida), si el texto es multilínea o si ocupa demasiadas filas.
 */
export function readInputLine(term: InputTermLike, block: InputBlockLike | undefined): InputLine | null {
  const from = block?.commandStart;
  if (!block || !from || from.isDisposed || block.outputStart) return null;
  const buf = term.buffer.active;
  const cursorLine = buf.baseY + buf.cursorY;
  const start = from.line;
  if (cursorLine < start || cursorLine - start >= MAX_INPUT_ROWS) return null;
  if (cursorLine === start && buf.cursorX < block.commandStartX) return null;

  let text = "";
  for (let l = start; l <= cursorLine; l++) {
    const line = buf.getLine(l);
    if (!line) return null;
    if (l > start && !line.isWrapped) return null; // multilínea real
    const startCol = l === start ? block.commandStartX : 0;
    text += l === cursorLine ? line.translateToString(false, startCol, buf.cursorX) : line.translateToString(false, startCol);
  }
  const cur = buf.getLine(cursorLine);
  const atEnd = !cur || cur.translateToString(true, buf.cursorX).trim() === "";
  return { text, atEnd };
}

const single = (s: string) => !/[\r\n]/u.test(s);

/**
 * Continuación sugerida para `text`: la entrada del historial (más usada y más reciente) que empieza
 * por él; si no hay, un snippet sin parámetros. Nunca sugiere secretos. Devuelve solo el sufijo.
 */
export function suggestFor(
  text: string,
  history: HistoryEntry[],
  snippets: SnippetLike[],
  historyEnabled: boolean,
): string | null {
  if (text.length < MIN_PREFIX || !single(text)) return null;
  const fits = (c: string) => c.length > text.length && c.startsWith(text) && single(c);

  const fromHistory = toCandidates(history, [], historyEnabled)
    .filter((c) => fits(c.text))
    .sort((a, b) => b.useCount - a.useCount || (a.lastUsedAt < b.lastUsedAt ? 1 : a.lastUsedAt > b.lastUsedAt ? -1 : 0));
  if (fromHistory.length) return fromHistory[0].text.slice(text.length);

  const snip = snippets.find((s) => fits(s.command_template) && !hasSnippetParams(s.command_template));
  return snip ? snip.command_template.slice(text.length) : null;
}

/** Siguiente palabra del sufijo (con sus espacios iniciales), o `""` si no queda nada. */
export function nextWord(suffix: string): string {
  return /^\s*\S+/u.exec(suffix)?.[0] ?? "";
}
