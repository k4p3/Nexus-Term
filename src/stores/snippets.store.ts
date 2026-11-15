import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CommandSnippet, SaveSnippetPayload } from '../types/snippets';
import { snippetsService } from '../services/snippets.service';

export const useSnippetsStore = defineStore('snippets', () => {
  const snippets = ref<CommandSnippet[]>([]);
  const isLoading = ref(false);
  const searchQuery = ref('');

  const filteredSnippets = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return snippets.value;
    return snippets.value.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.command_template.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  async function fetchSnippets() {
    isLoading.value = true;
    try {
      snippets.value = await snippetsService.getSnippets();
    } catch (err) {
      console.error('Failed to fetch snippets:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function saveSnippet(payload: SaveSnippetPayload): Promise<string> {
    const id = await snippetsService.saveSnippet(payload);
    await fetchSnippets();
    return id;
  }

  async function deleteSnippet(id: string): Promise<void> {
    await snippetsService.deleteSnippet(id);
    await fetchSnippets();
  }

  function extractParameters(template: string): string[] {
    const matches = template.matchAll(/\{\{([^}]+)\}\}/g);
    const params = new Set<string>();
    for (const match of matches) {
      params.add(match[1].trim());
    }
    return Array.from(params);
  }

  function substituteParameters(template: string, values: Record<string, string>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const trimmed = key.trim();
      return values[trimmed] !== undefined ? values[trimmed] : `{{${trimmed}}}`;
    });
  }

  return {
    snippets,
    isLoading,
    searchQuery,
    filteredSnippets,
    fetchSnippets,
    saveSnippet,
    deleteSnippet,
    extractParameters,
    substituteParameters,
  };
});
