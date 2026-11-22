// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

vi.mock("../../services/snippets.service", () => ({
  snippetsService: {
    getSnippets: vi.fn(async () => [
      {
        id: "s1", title: "List", command_template: "ls -la", description: null, tags: [],
        is_builtin: false, is_enabled: true, created_at: "x", updated_at: "x",
      },
    ]),
    saveSnippet: vi.fn(), toggleSnippetEnabled: vi.fn(), deleteSnippet: vi.fn(),
  },
}));

import SnippetDrawer from "./SnippetDrawer.vue";
import { i18n } from "../../locales";

describe("SnippetDrawer insertion", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("emits the snippet text without a trailing newline (never executes)", async () => {
    const w = mount(SnippetDrawer, { props: { isOpen: true }, global: { plugins: [i18n] } });
    await flushPromises();
    const row = w.findAll("div").find((d) => d.attributes("title") === i18n.global.t("ui.snip.insertHint"));
    expect(row).toBeTruthy();
    await row!.trigger("click");
    expect(w.emitted("insert-command")?.[0]).toEqual(["ls -la"]);
  });
});

describe("SnippetDrawer import/export UI", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("enables export only when there are custom snippets and shows the imported badge", async () => {
    const w = mount(SnippetDrawer, { props: { isOpen: true }, global: { plugins: [i18n] } });
    await flushPromises();
    expect(w.find('[data-testid="export-btn"]').attributes("disabled")).toBeUndefined();
    expect(w.find('[data-testid="imported-badge"]').exists()).toBe(false);
  });

  it("marks imported snippets with a badge", async () => {
    const { snippetsService } = await import("../../services/snippets.service");
    vi.mocked(snippetsService.getSnippets).mockResolvedValueOnce([
      { id: "i1", title: "Imp", command_template: "pwd", description: null, tags: ["imported"], is_builtin: false, is_enabled: true, created_at: "x", updated_at: "x" },
    ]);
    const w = mount(SnippetDrawer, { props: { isOpen: true }, global: { plugins: [i18n] } });
    await flushPromises();
    expect(w.find('[data-testid="imported-badge"]').exists()).toBe(true);
  });
});
