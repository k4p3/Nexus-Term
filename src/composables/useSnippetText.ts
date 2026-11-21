import { useI18n } from "vue-i18n";

interface SnippetLike {
  id: string;
  title: string;
  description?: string | null;
  is_builtin?: boolean;
}

/** Built-in snippets are stored in English; this shows their translated text when the locale provides it. */
export function useSnippetText() {
  const { t, te } = useI18n();
  const key = (s: SnippetLike, field: "title" | "description") => `ui.builtin.${s.id.replace(/^builtin-/, "")}.${field}`;

  function snippetTitle(s: SnippetLike): string {
    return s.is_builtin && te(key(s, "title")) ? t(key(s, "title")) : s.title;
  }
  function snippetDescription(s: SnippetLike): string {
    const k = key(s, "description");
    return s.is_builtin && te(k) ? t(k) : s.description || "";
  }
  return { snippetTitle, snippetDescription };
}
