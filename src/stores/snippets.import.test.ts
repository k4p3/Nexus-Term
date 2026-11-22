import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const svc = vi.hoisted(() => ({
  getSnippets: vi.fn(async () => [] as unknown[]),
  saveSnippet: vi.fn(async () => "id"),
  toggleSnippetEnabled: vi.fn(),
  deleteSnippet: vi.fn(),
}));
vi.mock("../services/snippets.service", () => ({ snippetsService: svc }));

import { useSnippetsStore } from "./snippets.store";

const payload = (title: string) => ({ title, command_template: "ls", tags: ["imported"], is_enabled: true });

describe("snippets store importSnippets", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    Object.values(svc).forEach((f) => f.mockClear());
  });

  it("saves sequentially, counts failures and reloads once", async () => {
    svc.saveSnippet.mockResolvedValueOnce("a").mockRejectedValueOnce("boom").mockResolvedValueOnce("c");
    const s = useSnippetsStore();
    const r = await s.importSnippets([payload("A"), payload("B"), payload("C")]);
    expect(r).toEqual({ created: 2, failed: 1 });
    expect(svc.saveSnippet).toHaveBeenCalledTimes(3);
    expect(svc.getSnippets).toHaveBeenCalledTimes(1);
  });

  it("handles an empty list", async () => {
    const s = useSnippetsStore();
    expect(await s.importSnippets([])).toEqual({ created: 0, failed: 0 });
  });
});
