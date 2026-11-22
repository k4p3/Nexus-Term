// Bloques de comandos basados en markers de xterm (OSC 133).
// Los markers siguen a su línea cuando el scrollback se recorta y se descartan (isDisposed)
// cuando la línea desaparece, a diferencia de los números de línea absolutos.

export interface DisposableLike {
  dispose(): void;
}
export interface MarkerLike {
  readonly id: number;
  readonly line: number;
  readonly isDisposed: boolean;
  onDispose(cb: () => void): DisposableLike;
  dispose(): void;
}
export interface BufferLineLike {
  readonly isWrapped: boolean;
  translateToString(trimRight?: boolean, startColumn?: number, endColumn?: number): string;
}
export interface TermLike {
  registerMarker(cursorYOffset?: number): MarkerLike | undefined;
  readonly buffer: {
    readonly active: {
      readonly baseY: number;
      readonly cursorX: number;
      readonly cursorY: number;
      getLine(y: number): BufferLineLike | undefined;
    };
  };
}

export type OscAction = "A" | "B" | "C" | "D";

export interface CommandBlock {
  id: number;
  prompt: MarkerLike;
  commandStart?: MarkerLike;
  commandStartX: number;
  outputStart?: MarkerLike;
  end?: MarkerLike;
  endX: number;
  exitCode?: number;
  startedAt?: number;
  durationMs?: number;
}

export interface LineRange {
  start: number;
  end: number; // inclusivo
}

function parseExit(arg: string | undefined): number {
  if (arg === undefined || arg === "") return 0;
  const n = parseInt(arg, 10);
  return Number.isNaN(n) ? 0 : n;
}

export class BlockTracker {
  private list: CommandBlock[] = [];
  private nextId = 1;

  constructor(
    private readonly term: TermLike,
    private readonly maxBlocks = 1000,
  ) {}

  /** Procesa un evento OSC 133. Devuelve el bloque que acaba de terminar (acción D). */
  onOsc(action: string, args: string[] = [], now: number = Date.now()): CommandBlock | undefined {
    const buf = this.term.buffer.active;
    switch (action) {
      case "A": {
        // Un prompt nunca ejecutado (p. ej. Ctrl+C) se reemplaza en lugar de acumularse.
        const last = this.last();
        if (last && !last.outputStart) this.remove(last);
        const prompt = this.term.registerMarker(0);
        if (!prompt) return undefined;
        const block: CommandBlock = {
          id: this.nextId++,
          prompt,
          commandStartX: 0,
          endX: 0,
          startedAt: now,
        };
        prompt.onDispose(() => this.removeById(block.id));
        this.list.push(block);
        while (this.list.length > this.maxBlocks) this.remove(this.list[0]);
        return undefined;
      }
      case "B": {
        const b = this.last();
        if (b) {
          b.commandStart = this.term.registerMarker(0);
          b.commandStartX = buf.cursorX;
        }
        return undefined;
      }
      case "C": {
        const b = this.last();
        if (b) {
          b.outputStart = this.term.registerMarker(0);
          b.startedAt = now;
        }
        return undefined;
      }
      case "D": {
        const b = this.last();
        if (!b || b.end) return undefined;
        b.end = this.term.registerMarker(0);
        b.endX = buf.cursorX;
        b.exitCode = parseExit(args[0]);
        if (b.outputStart && b.startedAt !== undefined) b.durationMs = Math.max(0, now - b.startedAt);
        return b;
      }
      default:
        return undefined;
    }
  }

  blocks(): CommandBlock[] {
    this.prune();
    return this.list;
  }

  /** Elimina bloques cuyo marker de prompt fue descartado. */
  prune(): void {
    for (const b of [...this.list]) if (b.prompt.isDisposed) this.remove(b);
  }

  /** Solo cuentan los bloques ya ejecutados (con salida iniciada). */
  executed(): CommandBlock[] {
    return this.blocks().filter((b) => !!b.outputStart);
  }

  hasBlocks(): boolean {
    return this.blocks().length > 0;
  }

  find(id: number): CommandBlock | undefined {
    return this.blocks().find((b) => b.id === id);
  }

  /** Bloque que contiene la línea absoluta indicada. */
  blockAtLine(line: number): CommandBlock | undefined {
    const list = this.blocks();
    let found: CommandBlock | undefined;
    for (const b of list) {
      if (b.prompt.line <= line) found = b;
      else break;
    }
    if (!found) return undefined;
    const r = this.lineRange(found);
    return line >= r.start && line <= r.end ? found : undefined;
  }

  /** Rango de líneas (inclusivo) del bloque: del prompt al final de la salida. */
  lineRange(b: CommandBlock): LineRange {
    const start = b.prompt.line;
    const buf = this.term.buffer.active;
    let end: number;
    if (b.end && !b.end.isDisposed) {
      end = b.endX > 0 ? b.end.line : b.end.line - 1;
    } else {
      end = buf.baseY + buf.cursorY;
    }
    return { start, end: Math.max(start, end) };
  }

  /** Texto del comando (entre B y C), uniendo líneas envueltas. */
  commandText(b: CommandBlock, trim = true): string {
    const from = b.commandStart;
    if (!from || from.isDisposed) return "";
    const buf = this.term.buffer.active;
    const stop = b.outputStart && !b.outputStart.isDisposed ? b.outputStart.line - 1 : from.line;
    const text = this.collect(from.line, Math.max(from.line, stop), b.commandStartX);
    return trim ? text.trim() : text.replace(/[\r\n]+$/u, "");
  }

  /** Texto de la salida (entre C y D). */
  outputText(b: CommandBlock): string {
    const from = b.outputStart;
    if (!from || from.isDisposed) return "";
    return this.collect(from.line, this.lineRange(b).end, 0).replace(/\s+$/u, "");
  }

  private collect(start: number, end: number, firstCol: number): string {
    const buf = this.term.buffer.active;
    let out = "";
    for (let l = start; l <= end; l++) {
      const line = buf.getLine(l);
      if (!line) continue;
      const text = line.translateToString(true, l === start ? firstCol : 0);
      if (l > start && !line.isWrapped) out += "\n";
      out += text;
    }
    return out;
  }

  dispose(): void {
    for (const b of [...this.list]) this.remove(b);
  }

  /** Bloque actual (el último, aún sin ejecutar si se está escribiendo en el prompt). */
  current(): CommandBlock | undefined {
    return this.last();
  }

  private last(): CommandBlock | undefined {
    this.prune();
    return this.list[this.list.length - 1];
  }

  private removeById(id: number): void {
    const b = this.list.find((x) => x.id === id);
    if (b) this.remove(b);
  }

  private remove(b: CommandBlock): void {
    const i = this.list.indexOf(b);
    if (i >= 0) this.list.splice(i, 1);
    for (const m of [b.prompt, b.commandStart, b.outputStart, b.end]) {
      if (m && !m.isDisposed) m.dispose();
    }
  }
}

export interface SearchMatch {
  line: number;
  col: number;
  length: number;
}

/** Busca texto solo dentro de un rango de líneas (búsqueda acotada a un bloque). */
export function searchInRange(
  term: Pick<TermLike, "buffer">,
  range: LineRange,
  query: string,
  opts: { caseSensitive?: boolean } = {},
): SearchMatch[] {
  if (!query) return [];
  const needle = opts.caseSensitive ? query : query.toLowerCase();
  const matches: SearchMatch[] = [];
  for (let l = range.start; l <= range.end; l++) {
    const line = term.buffer.active.getLine(l);
    if (!line) continue;
    const text = line.translateToString(true);
    const hay = opts.caseSensitive ? text : text.toLowerCase();
    let from = 0;
    for (;;) {
      const idx = hay.indexOf(needle, from);
      if (idx < 0) break;
      matches.push({ line: l, col: idx, length: needle.length });
      from = idx + Math.max(1, needle.length);
    }
  }
  return matches;
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}
