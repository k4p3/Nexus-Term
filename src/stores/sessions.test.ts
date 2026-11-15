import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSessionsStore } from './sessions.store';

describe('sessions store multiplexer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should create and activate a new session tab', () => {
    const store = useSessionsStore();
    expect(store.tabs.length).toBe(0);
    expect(store.activeTabId).toBeNull();

    const tabId = store.createTab('Terminal Local');
    expect(store.tabs.length).toBe(1);
    expect(store.activeTabId).toBe(tabId);
    expect(store.tabs[0].title).toBe('Terminal Local');
    expect(store.tabs[0].rootPane.type).toBe('leaf');
  });

  it('should split a tab pane into horizontal or vertical branches', () => {
    const store = useSessionsStore();
    const tabId = store.createTab('Main Tab');
    const tab = store.tabs[0];
    const initialPaneId = tab.activePaneId;

    store.splitPane(tabId, initialPaneId, 'horizontal');

    expect(tab.rootPane.type).toBe('split');
    if (tab.rootPane.type === 'split') {
      expect(tab.rootPane.direction).toBe('horizontal');
      expect(tab.rootPane.first.type).toBe('leaf');
      expect(tab.rootPane.second.type).toBe('leaf');
    }

    const leaves = store.getLeafPanesInTab(tabId);
    expect(leaves.length).toBe(2);
  });

  it('should toggle broadcast mode state', () => {
    const store = useSessionsStore();
    expect(store.isBroadcastMode).toBe(false);

    store.toggleBroadcastMode();
    expect(store.isBroadcastMode).toBe(true);

    store.toggleBroadcastMode();
    expect(store.isBroadcastMode).toBe(false);
  });

  it('should close a tab and update active tab gracefully', () => {
    const store = useSessionsStore();
    const t1 = store.createTab('Tab 1');
    const t2 = store.createTab('Tab 2');

    expect(store.tabs.length).toBe(2);
    expect(store.activeTabId).toBe(t2);

    store.closeTab(t2);
    expect(store.tabs.length).toBe(1);
    expect(store.activeTabId).toBe(t1);

    store.closeTab(t1);
    expect(store.tabs.length).toBe(0);
    expect(store.activeTabId).toBeNull();
  });
});
