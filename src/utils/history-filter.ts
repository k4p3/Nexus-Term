import { fuzzyScore } from "./fuzzy";

export const MAX_HISTORY_COMMAND_BYTES = 4096;

/** Patrones que delatan secretos en la línea de comandos: nunca se registran. */
export const SECRET_PATTERNS: RegExp[] = [
  /password/i,
  /passwd/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /authorization:/i,
  /export\s+\w*(KEY|TOKEN|SECRET)\w*=/i,
];

export type SkipReason = "empty" | "leading-space" | "too-long" | "secret";

/** Devuelve el motivo por el que NO se debe registrar el comando, o `null` si es válido. */
export function skipReason(raw: string): SkipReason | null {
  const cmd = raw.replace(/[\r\n]+$/u, "");
  if (cmd.trim() === "") return "empty";
  if (/^\s/u.test(cmd)) return "leading-space"; // convención de shells: prefijo de espacio = no guardar
  if (new TextEncoder().encode(cmd).length > MAX_HISTORY_COMMAND_BYTES) return "too-long";
  if (SECRET_PATTERNS.some((re) => re.test(cmd))) return "secret";
  return null;
}

export function shouldRecordCommand(raw: string): boolean {
  return skipReason(raw) === null;
}

export interface Rankable {
  text: string;
  use_count: number;
  last_used_at: string;
}

/**
 * Ordena por puntuación difusa, luego por veces usado y por recencia.
 * Sin consulta se conserva el orden recibido (más reciente primero).
 * La puntuación se trunca a entero para que el desempate por uso/recencia sea efectivo.
 */
export function rankHistory<T extends Rankable>(items: T[], query: string): T[] {
  if (!query.trim()) return items;
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const s = fuzzyScore(query, item.text);
    if (s !== null) scored.push({ item, score: Math.floor(s) });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.item.use_count - a.item.use_count ||
      (a.item.last_used_at < b.item.last_used_at ? 1 : a.item.last_used_at > b.item.last_used_at ? -1 : 0),
  );
  return scored.map((x) => x.item);
}

/** Clave de historial para un panel: id del host SSH o `local` para shells locales. */
export function historyHostKey(hostId: string | null | undefined): string {
  return hostId && hostId.length > 0 ? hostId : "local";
}
