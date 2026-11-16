import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSnippetsStore } from './snippets.store';
import type { CommandSnippet } from '../types/snippets';

describe('snippets store parameter engine and state management', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should extract dynamic parameters from {{param}} placeholders', () => {
    const store = useSnippetsStore();
    const template = 'docker run -d -p {{host_port}}:80 --name {{container_name}} {{image}}';

    const params = store.extractParameters(template);
    expect(params).toEqual(['host_port', 'container_name', 'image']);
  });

  it('should deduplicate repeating parameters in template', () => {
    const store = useSnippetsStore();
    const template = 'echo {{message}} > log.txt && echo {{message}}';

    const params = store.extractParameters(template);
    expect(params).toEqual(['message']);
  });

  it('should substitute parameters with provided values', () => {
    const store = useSnippetsStore();
    const template = 'curl -H "Authorization: Bearer {{token}}" https://api.com/v1/{{resource}}';

    const result = store.substituteParameters(template, {
      token: 'secret-xyz',
      resource: 'users',
    });

    expect(result).toBe('curl -H "Authorization: Bearer secret-xyz" https://api.com/v1/users');
  });

  it('should leave missing parameters as placeholders', () => {
    const store = useSnippetsStore();
    const template = 'git commit -m "{{message}}" --author="{{author}}"';

    const result = store.substituteParameters(template, {
      message: 'feat: add feature',
    });

    expect(result).toBe('git commit -m "feat: add feature" --author="{{author}}"');
  });

  it('should filter snippets by origin and enabled state', () => {
    const store = useSnippetsStore();
    const mockSnippets: CommandSnippet[] = [
      {
        id: 'builtin-1',
        title: 'Docker Logs',
        command_template: 'docker logs',
        description: 'Logs',
        tags: ['docker'],
        is_builtin: true,
        is_enabled: true,
        created_at: '2026-11-15T00:00:00Z',
        updated_at: '2026-11-15T00:00:00Z',
      },
      {
        id: 'builtin-2',
        title: 'Systemctl Status',
        command_template: 'systemctl status',
        description: 'Status',
        tags: ['system'],
        is_builtin: true,
        is_enabled: false,
        created_at: '2026-11-15T00:00:00Z',
        updated_at: '2026-11-15T00:00:00Z',
      },
      {
        id: 'custom-1',
        title: 'My Custom Script',
        command_template: './run.sh',
        description: null,
        tags: ['custom'],
        is_builtin: false,
        is_enabled: true,
        created_at: '2026-11-15T00:00:00Z',
        updated_at: '2026-11-15T00:00:00Z',
      },
    ];

    store.snippets = mockSnippets;

    // 1. By default, disabled snippets are hidden
    expect(store.filteredSnippets.length).toBe(2);
    expect(store.filteredSnippets.map((s) => s.id)).toEqual(['builtin-1', 'custom-1']);

    // 2. When showDisabled is enabled, all 3 are returned
    store.showDisabled = true;
    expect(store.filteredSnippets.length).toBe(3);

    // 3. Filter by community origin
    store.originFilter = 'community';
    expect(store.filteredSnippets.map((s) => s.id)).toEqual(['builtin-1', 'builtin-2']);

    // 4. Filter by custom origin
    store.originFilter = 'custom';
    expect(store.filteredSnippets.map((s) => s.id)).toEqual(['custom-1']);

    // 5. Computed lists
    expect(store.communitySnippets.length).toBe(2);
    expect(store.customSnippets.length).toBe(1);
    expect(store.enabledSnippets.length).toBe(2);
  });
});
