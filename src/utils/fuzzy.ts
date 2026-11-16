/**
 * Puntuación difusa: mayor es mejor; `null` si `query` no es subsecuencia de `text`.
 * Prioriza prefijo, inicio de palabra y caracteres consecutivos.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();
  let score = 0;
  let ti = 0;
  let prevMatch = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti);
    if (idx === -1) return null;
    let s = 1;
    if (idx === prevMatch + 1) s += 5; // consecutivo
    if (idx === 0) s += 8; // prefijo
    else if (/[\s\-_/.:]/.test(t[idx - 1])) s += 4; // inicio de palabra
    score += s;
    prevMatch = idx;
    ti = idx + 1;
  }
  if (t.startsWith(q)) score += 10;
  else if (t.includes(q)) score += 5;
  // Penaliza textos largos para desempatar
  return score - text.length * 0.01;
}

export function fuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string): T[] {
  if (!query.trim()) return items;
  return items
    .map((item) => ({ item, score: fuzzyScore(query, getText(item)) }))
    .filter((x): x is { item: T; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
