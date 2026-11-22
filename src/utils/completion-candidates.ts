import type { HistoryEntry } from "../types/history";
import { rankHistory, skipReason } from "./history-filter";

export interface SnippetLike {
  id: string;
  title: string;
  command_template: string;
}

export interface Candidate {
  /** `h:<id>` para historial, `s:<id>` para snippets. */
  id: string;
  kind: "history" | "snippet";
  /** Texto que se inserta. */
  text: string;
  /** Texto sobre el que se calcula la coincidencia difusa. */
  searchText: string;
  useCount: number;
  lastUsedAt: string;
  exitCode: number | null;
  snippetId?: string;
}

export interface CandidateOptions {
  /** Con `false` solo se ofrecen snippets. */
  historyEnabled: boolean;
  /** Máximo de resultados (por defecto, sin límite). */
  limit?: number;
}

/**
 * Convierte historial y snippets en candidatos. Las entradas de historial que coinciden con los
 * patrones de secretos nunca se ofrecen; los snippets los escribe el usuario y no se filtran.
 */
export function toCandidates(
  history: HistoryEntry[],
  snippets: SnippetLike[],
  historyEnabled = true,
): Candidate[] {
  const out: Candidate[] = [];
  if (historyEnabled) {
    for (const e of history) {
      if (skipReason(e.command) === "secret") continue;
      out.push({
        id: `h:${e.id}`,
        kind: "history",
        text: e.command,
        searchText: e.command,
        useCount: e.use_count,
        lastUsedAt: e.last_used_at,
        exitCode: e.last_exit_code,
      });
    }
  }
  for (const s of snippets) {
    out.push({
      id: `s:${s.id}`,
      kind: "snippet",
      text: s.command_template,
      searchText: `${s.title} ${s.command_template}`,
      useCount: 0,
      lastUsedAt: "",
      exitCode: null,
      snippetId: s.id,
    });
  }
  return out;
}

/** Ordena por coincidencia difusa, uso y recencia; sin consulta conserva el orden recibido. */
export function rankCandidates(candidates: Candidate[], query: string): Candidate[] {
  const ranked = rankHistory(
    candidates.map((c) => ({ c, text: c.searchText, use_count: c.useCount, last_used_at: c.lastUsedAt })),
    query,
  );
  return ranked.map((r) => r.c);
}

/** Candidatos ya ordenados para `query`. Oculta los que coinciden exactamente con lo escrito. */
export function buildCandidates(
  history: HistoryEntry[],
  snippets: SnippetLike[],
  query: string,
  opts: CandidateOptions,
): Candidate[] {
  const typed = query.trim();
  let list = rankCandidates(toCandidates(history, snippets, opts.historyEnabled), query);
  if (typed) list = list.filter((c) => c.text.trim() !== typed);
  return opts.limit !== undefined ? list.slice(0, opts.limit) : list;
}
