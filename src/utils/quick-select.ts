export type MatchKind = "url" | "email" | "uuid" | "ipv6" | "ipv4" | "path" | "sha" | "number";

export interface Hint {
  text: string;
  row: number;
  col: number;
  len: number;
  kind: MatchKind;
  label: string;
}

export const DEFAULT_ALPHABET = "asdfghjklqwertyuiopzxcvbnm";
export const MAX_HINTS = 676;

export function isValidIPv4(s: string): boolean {
  const parts = s.split(".");
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255 && String(Number(p)) === p.replace(/^0+(?=\d)/, ""));
}

export function isValidIPv6(s: string): boolean {
  if (!/^[0-9a-f:]+$/i.test(s)) return false;
  const doubles = s.split("::").length - 1;
  if (doubles > 1 || s.includes(":::")) return false;
  const groups = s.split(":").filter((g, i, arr) => !(g === "" && (i === 0 || i === arr.length - 1 || doubles)));
  if (groups.some((g) => g.length > 4)) return false;
  return doubles === 1 ? groups.length <= 7 : groups.length === 8;
}

interface Rule {
  kind: MatchKind;
  re: RegExp;
  validate?: (text: string) => boolean;
  trim?: RegExp;
}

const RULES: Rule[] = [
  { kind: "url", re: /\bhttps?:\/\/[^\s<>"'`]+/g, trim: /[.,;:!?)\]}]+$/ },
  { kind: "email", re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g },
  { kind: "uuid", re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
  { kind: "ipv6", re: /(?<![\w:])[0-9a-f:]{3,39}(?![\w:])/gi, validate: (s) => s.includes(":") && isValidIPv6(s) },
  {
    kind: "ipv4",
    re: /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.]*\d)/g,
    validate: isValidIPv4,
  },
  { kind: "path", re: /(?<![\w/:.-])(?:~|\.{1,2})?\/[\w.@+-]+(?:\/[\w.@+-]+)*|(?<![\w/:.-])(?:[\w.@+-]+\/)+[\w@+-]+\.[A-Za-z0-9]{1,8}\b/g, trim: /[.,;:]+$/ },
  { kind: "sha", re: /\b[0-9a-f]{7,40}\b/gi, validate: (s) => /\d/.test(s) && /[a-f]/i.test(s) },
  { kind: "number", re: /\b\d{4,}\b/g },
];

interface Raw {
  text: string;
  col: number;
  kind: MatchKind;
}

function scanLine(line: string): Raw[] {
  const accepted: Raw[] = [];
  const overlaps = (s: number, e: number) => accepted.some((a) => s < a.col + a.text.length && a.col < e);
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(line))) {
      let text = m[0];
      if (rule.trim) text = text.replace(rule.trim, "");
      if (!text) continue;
      if (rule.validate && !rule.validate(text)) continue;
      if (!overlaps(m.index, m.index + text.length)) accepted.push({ text, col: m.index, kind: rule.kind });
    }
  }
  return accepted.sort((a, b) => a.col - b.col);
}

/** Etiquetas sin prefijos comunes: 1 letra si caben; si no, todas las combinaciones de 2. */
export function assignLabels(count: number, alphabet = DEFAULT_ALPHABET): string[] {
  const letters = [...alphabet];
  if (count <= letters.length) return letters.slice(0, count);
  const out: string[] = [];
  for (const a of letters) for (const b of letters) out.push(a + b);
  return out.slice(0, count);
}

/**
 * Detecta coincidencias en las líneas visibles. Cada texto distinto recibe una etiqueta
 * (los más cercanos al final de la pantalla primero); las repeticiones comparten etiqueta.
 */
export function buildHints(lines: string[], alphabet = DEFAULT_ALPHABET): Hint[] {
  const raw: { row: number; m: Raw }[] = [];
  lines.forEach((line, row) => scanLine(line).forEach((m) => raw.push({ row, m })));

  const distinct: string[] = [];
  for (let i = raw.length - 1; i >= 0; i--) {
    const t = raw[i].m.text;
    if (!distinct.includes(t)) distinct.push(t);
  }
  const limited = distinct.slice(0, MAX_HINTS);
  const labels = assignLabels(limited.length, alphabet);
  const labelOf = new Map(limited.map((t, i) => [t, labels[i]]));

  return raw
    .filter(({ m }) => labelOf.has(m.text))
    .map(({ row, m }) => ({ text: m.text, row, col: m.col, len: m.text.length, kind: m.kind, label: labelOf.get(m.text)! }));
}

export type LabelResolution =
  | { state: "match"; hint: Hint; paste: boolean }
  | { state: "prefix" }
  | { state: "none" };

/** Resuelve lo escrito: mayúscula en cualquier letra ⇒ pegar; minúsculas ⇒ copiar. */
export function resolveLabel(typed: string, hints: Hint[]): LabelResolution {
  if (!typed) return { state: "prefix" };
  const key = typed.toLowerCase();
  const paste = typed !== key;
  const exact = hints.find((h) => h.label === key);
  if (exact) return { state: "match", hint: exact, paste };
  return hints.some((h) => h.label.startsWith(key)) ? { state: "prefix" } : { state: "none" };
}
