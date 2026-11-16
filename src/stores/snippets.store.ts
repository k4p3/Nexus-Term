import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CommandSnippet, SaveSnippetPayload } from '../types/snippets';
import { snippetsService } from '../services/snippets.service';

export type SnippetOriginFilter = 'all' | 'community' | 'custom';

export const useSnippetsStore = defineStore('snippets', () => {
  const snippets = ref<CommandSnippet[]>([]);
  const isLoading = ref(false);
  const searchQuery = ref('');
  const originFilter = ref<SnippetOriginFilter>('all');
  const showDisabled = ref(false);

  const communitySnippets = computed(() => snippets.value.filter((s) => s.is_builtin));
  const customSnippets = computed(() => snippets.value.filter((s) => !s.is_builtin));
  const enabledSnippets = computed(() => snippets.value.filter((s) => s.is_enabled));

  const filteredSnippets = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    return snippets.value.filter((s) => {
      // 1. Disabled visibility filter
      if (!showDisabled.value && !s.is_enabled) {
        return false;
      }

      // 2. Origin filter
      if (originFilter.value === 'community' && !s.is_builtin) {
        return false;
      }
      if (originFilter.value === 'custom' && s.is_builtin) {
        return false;
      }

      // 3. Search query filter
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.command_template.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
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

  async function toggleSnippetEnabled(id: string, enabled: boolean): Promise<void> {
    // Optimistic update
    const target = snippets.value.find((s) => s.id === id);
    if (target) {
      target.is_enabled = enabled;
    }
    await snippetsService.toggleSnippetEnabled(id, enabled);
  }

  async function duplicateSnippet(snippet: CommandSnippet): Promise<string> {
    const payload: SaveSnippetPayload = {
      title: `${snippet.title} (Copia)`,
      command_template: snippet.command_template,
      description: snippet.description,
      tags: [...snippet.tags],
      is_enabled: true,
    };
    return await saveSnippet(payload);
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
    originFilter,
    showDisabled,
    communitySnippets,
    customSnippets,
    enabledSnippets,
    filteredSnippets,
    fetchSnippets,
    saveSnippet,
    toggleSnippetEnabled,
    duplicateSnippet,
    deleteSnippet,
    extractParameters,
    substituteParameters,
  };
});
