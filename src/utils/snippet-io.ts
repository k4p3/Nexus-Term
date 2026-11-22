import type { CommandSnippet, SaveSnippetPayload } from "../types/snippets";
import { analyzePaste } from "./paste-guard";

export const SNIPPET_FORMAT = "nexusterm-snippets";
export const SNIPPET_FORMAT_VERSION = 1;
export const IMPORTED_TAG = "imported";

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_SNIPPETS = 500;
export const MAX_TITLE = 120;
export const MAX_COMMAND = 8000;
export const MAX_DESCRIPTION = 500;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 32;

/** Saltos de línea, controles C0/C1 (salvo tabulador), bidi y caracteres de ancho cero o invisibles. */
const UNSAFE_RE = /[\u0000-\u0008\u000A-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]/u;

export type FileErrorCode = "tooLarge" | "badJson" | "badFormat" | "badVersion" | "noSnippets" | "tooMany";
export type InvalidReason = "notObject" | "title" | "command" | "description" | "tags" | "unsafe" | "tooLong";

export interface ImportItem {
  title: string;
  command: string;
  description: string | null;
  tags: string[];
  /** Patrones de riesgo detectados en el comando (informativo). */
  warnings: string[];
}
export interface SkippedItem {
  index: number;
  title: string;
  reason: "duplicate" | "duplicateInFile";
}
export interface InvalidItem {
  index: number;
  reason: InvalidReason;
}

export type ParseResult =
  | { ok: false; error: FileErrorCode }
  | { ok: true; toImport: ImportItem[]; skipped: SkippedItem[]; invalid: InvalidItem[] };

const keyOf = (title: string, command: string) => `${title.trim()}\u0000${command}`;

function validate(raw: unknown): ImportItem | InvalidReason {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "notObject";
  const o = raw as Record<string, unknown>;
  if (typeof o.title !== "string" || !o.title.trim()) return "title";
  if (typeof o.command !== "string" || !o.command.trim()) return "command";
  if (o.description !== undefined && o.description !== null && typeof o.description !== "string") return "description";
  if (o.tags !== undefined && !(Array.isArray(o.tags) && o.tags.every((t) => typeof t === "string"))) return "tags";

  const title = o.title.trim();
  const command = o.command;
  const description = typeof o.description === "string" && o.description.trim() ? o.description.trim() : null;
  const tags = [...new Set(((o.tags as string[] | undefined) ?? []).map((t) => t.trim()).filter(Boolean))].filter(
    (t) => t !== IMPORTED_TAG,
  );

  if ([title, command, description ?? "", ...tags].some((s) => UNSAFE_RE.test(s))) return "unsafe";
  if (
    title.length > MAX_TITLE || command.length > MAX_COMMAND || (description?.length ?? 0) > MAX_DESCRIPTION ||
    tags.length > MAX_TAGS || tags.some((t) => t.length > MAX_TAG_LENGTH)
  ) {
    return "tooLong";
  }
  const warnings = [...new Set(analyzePaste(command).dangerous.map((d) => d.pattern))];
  return { title, command, description, tags: [...tags, IMPORTED_TAG], warnings };
}

/** Analiza y valida un fichero de snippets. No toca nada: devuelve qué se importaría, omitiría o rechazaría. */
export function parseSnippetFile(text: string, existing: Pick<CommandSnippet, "title" | "command_template">[]): ParseResult {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) return { ok: false, error: "tooLarge" };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "badJson" };
  }
  const root = data as Record<string, unknown> | null;
  if (!root || typeof root !== "object" || root.format !== SNIPPET_FORMAT) return { ok: false, error: "badFormat" };
  if (root.version !== SNIPPET_FORMAT_VERSION) return { ok: false, error: "badVersion" };
  if (!Array.isArray(root.snippets)) return { ok: false, error: "noSnippets" };
  if (root.snippets.length > MAX_SNIPPETS) return { ok: false, error: "tooMany" };

  const seen = new Set(existing.map((s) => keyOf(s.title, s.command_template)));
  const toImport: ImportItem[] = [];
  const skipped: SkippedItem[] = [];
  const invalid: InvalidItem[] = [];
  const inFile = new Set<string>();

  root.snippets.forEach((raw, index) => {
    const v = validate(raw);
    if (typeof v === "string") return void invalid.push({ index, reason: v });
    const k = keyOf(v.title, v.command);
    if (seen.has(k)) return void skipped.push({ index, title: v.title, reason: "duplicate" });
    if (inFile.has(k)) return void skipped.push({ index, title: v.title, reason: "duplicateInFile" });
    inFile.add(k);
    toImport.push(v);
  });
  return { ok: true, toImport, skipped, invalid };
}

/** Serializa los snippets personalizados (no integrados) al formato `nexusterm-snippets` v1. */
export function serializeSnippets(snippets: CommandSnippet[]): string {
  const list = snippets
    .filter((s) => !s.is_builtin)
    .map((s) => ({
      title: s.title,
      command: s.command_template,
      ...(s.description ? { description: s.description } : {}),
      ...(s.tags.filter((t) => t !== IMPORTED_TAG).length ? { tags: s.tags.filter((t) => t !== IMPORTED_TAG) } : {}),
    }));
  return JSON.stringify({ format: SNIPPET_FORMAT, version: SNIPPET_FORMAT_VERSION, snippets: list }, null, 2) + "\n";
}

export function toSavePayload(item: ImportItem): SaveSnippetPayload {
  return {
    title: item.title,
    command_template: item.command,
    description: item.description,
    tags: item.tags,
    is_enabled: true,
  };
}
