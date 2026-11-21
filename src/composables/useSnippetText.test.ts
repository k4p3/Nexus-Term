import { describe, it, expect } from "vitest";
import { createI18n } from "vue-i18n";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { useSnippetText } from "./useSnippetText";

function setup(locale: string) {
  const i18n = createI18n({
    legacy: false,
    locale,
    fallbackLocale: "en",
    messages: {
      en: { ui: { builtin: { x: { title: "Follow Logs", description: "Follows logs" } } } },
      es: { ui: { builtin: { x: { title: "Seguir Logs", description: "Sigue los logs" } } } },
    },
  });
  let api!: ReturnType<typeof useSnippetText>;
  mount(defineComponent({ setup() { api = useSnippetText(); return () => null; } }), { global: { plugins: [i18n] } });
  return api;
}

describe("useSnippetText", () => {
  it("translates built-in snippets with the active locale", () => {
    const s = { id: "builtin-x", title: "Follow Logs", description: "Follows logs", is_builtin: true };
    expect(setup("es").snippetTitle(s)).toBe("Seguir Logs");
    expect(setup("es").snippetDescription(s)).toBe("Sigue los logs");
    expect(setup("en").snippetTitle(s)).toBe("Follow Logs");
  });

  it("never rewrites user snippets and falls back to stored text for unknown built-ins", () => {
    const api = setup("es");
    expect(api.snippetTitle({ id: "builtin-x", title: "Mine", is_builtin: false })).toBe("Mine");
    expect(api.snippetTitle({ id: "builtin-new", title: "Stored", is_builtin: true })).toBe("Stored");
    expect(api.snippetDescription({ id: "u1", title: "t", description: "custom" })).toBe("custom");
  });
});
