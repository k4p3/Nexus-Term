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

  it('focusNeighborPane moves the active pane and reports whether it moved', () => {
    const store = useSessionsStore();
    const tabId = store.createTab('Main Tab');
    const tab = store.tabs[0];
    const first = tab.activePaneId;
    store.splitPane(tabId, first, 'horizontal');
    const leaves = store.getLeafPanesInTab(tabId);
    expect(leaves).toHaveLength(2);
    const second = leaves.find((l) => l.id !== first)!.id;

    store.setActivePane(tabId, first);
    expect(store.focusNeighborPane(tabId, 'right')).toBe(true);
    expect(tab.activePaneId).toBe(second);
    expect(store.focusNeighborPane(tabId, 'left')).toBe(true);
    expect(tab.activePaneId).toBe(first);
  });

  it('focusNeighborPane leaves the state untouched when there is no neighbour', () => {
    const store = useSessionsStore();
    const tabId = store.createTab('Main Tab');
    const tab = store.tabs[0];
    const only = tab.activePaneId;
    expect(store.focusNeighborPane(tabId, 'right')).toBe(false);
    expect(store.focusNeighborPane('missing-tab', 'left')).toBe(false);
    expect(tab.activePaneId).toBe(only);

    store.splitPane(tabId, only, 'horizontal');
    store.setActivePane(tabId, only);
    expect(store.focusNeighborPane(tabId, 'left')).toBe(false);
    expect(store.focusNeighborPane(tabId, 'up')).toBe(false);
    expect(tab.activePaneId).toBe(only);
  });

  describe('activateAdjacentTab', () => {
    it('cycles forward and backward across tabs', () => {
      const store = useSessionsStore();
      const a = store.createTab('A');
      const b = store.createTab('B');
      const c = store.createTab('C');
      expect(store.activeTabId).toBe(c);
      store.activateAdjacentTab(1);
      expect(store.activeTabId).toBe(a);
      store.activateAdjacentTab(-1);
      expect(store.activeTabId).toBe(c);
      store.activateAdjacentTab(-1);
      expect(store.activeTabId).toBe(b);
    });

    it('does nothing with zero or one tab', () => {
      const store = useSessionsStore();
      store.activateAdjacentTab(1);
      expect(store.activeTabId).toBeNull();
      const a = store.createTab('A');
      store.activateAdjacentTab(1);
      store.activateAdjacentTab(-1);
      expect(store.activeTabId).toBe(a);
    });
  });

  describe('activateTabByIndex', () => {
    it('activates the tab at a valid position', () => {
      const store = useSessionsStore();
      const a = store.createTab('A');
      store.createTab('B');
      store.createTab('C');
      store.activateTabByIndex(0);
      expect(store.activeTabId).toBe(a);
    });

    it('ignores positions that do not exist', () => {
      const store = useSessionsStore();
      store.createTab('A');
      const b = store.createTab('B');
      store.activateTabByIndex(4);
      store.activateTabByIndex(-1);
      expect(store.activeTabId).toBe(b);
      store.activateTabByIndex(store.tabs.length - 1);
      expect(store.activeTabId).toBe(b);
    });

    it('does nothing without tabs', () => {
      const store = useSessionsStore();
      store.activateTabByIndex(-1);
      expect(store.activeTabId).toBeNull();
    });
  });
});
