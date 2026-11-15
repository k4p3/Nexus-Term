import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSnippetsStore } from './snippets.store';

describe('snippets store parameter engine', () => {
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
});
