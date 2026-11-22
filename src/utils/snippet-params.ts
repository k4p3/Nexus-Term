/** Parámetro de snippet: `{{nombre}}` o `{{nombre=valor}}`. Debe empezar por letra o `_`, así que las
 *  plantillas de Go de `docker --format '{{.ID}}'` se dejan tal cual. */
export const SNIPPET_PARAM_RE = /\{\{\s*([A-Za-z_][^}]*)\}\}/g;

export function hasSnippetParams(template: string): boolean {
  return new RegExp(SNIPPET_PARAM_RE.source).test(template);
}
