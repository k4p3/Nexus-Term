export interface DangerousMatch {
  pattern: string;
  index: number;
  length: number;
}

export interface PasteAnalysis {
  lines: number;
  bytes: number;
  dangerous: DangerousMatch[];
  controlChars: number;
  zeroWidth: number;
  looksSecret: boolean;
  needsConfirm: boolean;
}

export const MAX_UNCONFIRMED_BYTES = 64 * 1024;

const DANGEROUS: { name: string; re: RegExp }[] = [
  { name: "sudo", re: /\bsudo\b/g },
  { name: "rm -rf", re: /\brm\s+-[a-z]*r[a-z]*f[a-z]*\b|\brm\s+-[a-z]*f[a-z]*r[a-z]*\b/g },
  { name: "dd", re: /\bdd\s+if=/g },
  { name: "mkfs", re: /\bmkfs(?:\.\w+)?\b/g },
  { name: "chmod -R 777", re: /\bchmod\s+-R\s+777\b/g },
  { name: "pipe-to-shell", re: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z|da)?sh\b/g },
  { name: "fork bomb", re: /:\(\)\s*\{/g },
  { name: "> /dev/sd", re: />\s*\/dev\/sd[a-z]/g },
];

// Caracteres de control (salvo tab, LF y CR), DEL y secuencias C1.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u0080-\u009f]/g;
const ZERO_WIDTH_RE = new RegExp("[\\u200b-\\u200f\\u2028\\u2029\\u202a-\\u202e\\u2060-\\u2064\\ufeff]", "g");

export function looksLikeSecret(text: string): boolean {
  const t = text.trim();
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t)) return true;
  return /^[A-Za-z0-9+/=_-]{40,}$/.test(t) && !/\s/.test(t);
}

export function analyzePaste(text: string): PasteAnalysis {
  const normalized = text.replace(/\r\n?/g, "\n");
  const trimmedEnd = normalized.replace(/\n+$/, "");
  const lines = trimmedEnd === "" ? (normalized.length ? 1 : 0) : trimmedEnd.split("\n").length;
  const dangerous: DangerousMatch[] = [];
  for (const { name, re } of DANGEROUS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) dangerous.push({ pattern: name, index: m.index, length: m[0].length });
  }
  dangerous.sort((a, b) => a.index - b.index);
  const controlChars = (text.match(CONTROL_RE) ?? []).length;
  const zeroWidth = (text.match(ZERO_WIDTH_RE) ?? []).length;
  const bytes = new TextEncoder().encode(text).length;
  // Una sola línea con un salto final también es multilínea para el shell (ejecuta al pegar).
  const multiline = lines > 1 || (lines === 1 && /\n/.test(normalized));
  return {
    lines,
    bytes,
    dangerous,
    controlChars,
    zeroWidth,
    looksSecret: looksLikeSecret(text),
    needsConfirm: multiline || dangerous.length > 0 || controlChars > 0 || zeroWidth > 0 || bytes > MAX_UNCONFIRMED_BYTES,
  };
}

const CONTROL_NAMES: Record<number, string> = { 0x1b: "␛", 0: "␀", 0x7f: "␡", 0x07: "␇", 0x08: "␈" };

/** Hace visibles los caracteres de control y de ancho cero para la vista previa. */
export function visualizeControlChars(text: string): string {
  return text
    .replace(CONTROL_RE, (c) => CONTROL_NAMES[c.charCodeAt(0)] ?? `⟦${c.charCodeAt(0).toString(16).padStart(2, "0")}⟧`)
    .replace(ZERO_WIDTH_RE, (c) => `⟦${c.charCodeAt(0).toString(16).toUpperCase()}⟧`);
}

export function toSingleLine(text: string): string {
  return text.replace(/\r\n?|\n/g, " ").replace(/ {2,}/g, " ").trim();
}

/** Vista enmascarada para entradas del historial con aspecto de secreto. */
export function maskedPreview(text: string): string {
  return looksLikeSecret(text) ? "•••••••• (secreto oculto)" : text;
}

export interface PreviewSegment {
  text: string;
  danger: boolean;
}

export const PREVIEW_MAX_CHARS = 2000;

/** Divide la vista previa en segmentos, marcando los fragmentos peligrosos. */
export function previewSegments(text: string, dangerous: DangerousMatch[]): PreviewSegment[] {
  const clipped = text.length > PREVIEW_MAX_CHARS ? text.slice(0, PREVIEW_MAX_CHARS) : text;
  const out: PreviewSegment[] = [];
  let pos = 0;
  for (const d of [...dangerous].sort((a, b) => a.index - b.index)) {
    if (d.index >= clipped.length) break;
    if (d.index < pos) continue; // solapado
    if (d.index > pos) out.push({ text: visualizeControlChars(clipped.slice(pos, d.index)), danger: false });
    const end = Math.min(d.index + d.length, clipped.length);
    out.push({ text: visualizeControlChars(clipped.slice(d.index, end)), danger: true });
    pos = end;
  }
  if (pos < clipped.length) out.push({ text: visualizeControlChars(clipped.slice(pos)), danger: false });
  if (text.length > PREVIEW_MAX_CHARS) out.push({ text: "…", danger: false });
  return out;
}
