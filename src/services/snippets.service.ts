import { invoke } from '@tauri-apps/api/core';
import type { CommandSnippet, SaveSnippetPayload } from '../types/snippets';

export const snippetsService = {
  async getSnippets(): Promise<CommandSnippet[]> {
    return await invoke<CommandSnippet[]>('get_snippets');
  },

  async saveSnippet(payload: SaveSnippetPayload): Promise<string> {
    return await invoke<string>('save_snippet', { payload });
  },

  async deleteSnippet(id: string): Promise<void> {
    await invoke('delete_snippet', { id });
  },
};
