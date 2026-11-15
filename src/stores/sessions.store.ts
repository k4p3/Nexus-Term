import { defineStore } from "pinia";
import { ref } from "vue";
import type { HostSummary } from "../types/inventory";
import type { SessionTab, PaneNode, LeafPane, SplitDirection } from "../types/session";
import { sessionService } from "../services/session.service";

function generateId(): string {
  return "pane-" + Math.random().toString(36).substring(2, 9);
}

export const useSessionsStore = defineStore("sessions", () => {
  const tabs = ref<SessionTab[]>([]);
  const activeTabId = ref<string | null>(null);
  const isBroadcastMode = ref(false);
  const paneSessionMap = ref<Record<string, string>>({});

  function registerPaneSession(paneId: string, sessionId: string) {
    paneSessionMap.value[paneId] = sessionId;
  }

  function unregisterPaneSession(paneId: string) {
    delete paneSessionMap.value[paneId];
  }

  function toggleBroadcastMode() {
    isBroadcastMode.value = !isBroadcastMode.value;
  }

  function getLeafPanesInTab(tabId: string): LeafPane[] {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (!tab) return [];

    const leaves: LeafPane[] = [];
    function collect(node: PaneNode) {
      if (node.type === "leaf") {
        leaves.push(node);
      } else {
        collect(node.first);
        collect(node.second);
      }
    }
    collect(tab.rootPane);
    return leaves;
  }

  function broadcastData(sourcePaneId: string, tabId: string, data: Uint8Array) {
    if (!isBroadcastMode.value) return;
    const leaves = getLeafPanesInTab(tabId);
    for (const leaf of leaves) {
      if (leaf.id !== sourcePaneId) {
        const sid = paneSessionMap.value[leaf.id];
        if (sid) {
          sessionService.writeSession(sid, data).catch((err) => {
            console.error("Broadcast write error:", err);
          });
        }
      }
    }
  }

  function createTab(title?: string, host?: HostSummary): string {
    const tabId = "tab-" + Math.random().toString(36).substring(2, 9);
    const paneId = generateId();
    const tabTitle = title || (host ? host.label : "Local Shell");

    const leaf: LeafPane = {
      type: "leaf",
      id: paneId,
      title: tabTitle,
      hostId: host?.id,
      host,
    };

    const newTab: SessionTab = {
      id: tabId,
      title: tabTitle,
      rootPane: leaf,
      activePaneId: paneId,
    };

    tabs.value.push(newTab);
    activeTabId.value = tabId;
    return tabId;
  }

  function closeTab(tabId: string) {
    const idx = tabs.value.findIndex((t) => t.id === tabId);
    if (idx !== -1) {
      tabs.value.splice(idx, 1);
      if (activeTabId.value === tabId) {
        if (tabs.value.length > 0) {
          activeTabId.value = tabs.value[Math.max(0, idx - 1)].id;
        } else {
          activeTabId.value = null;
        }
      }
    }
  }

  function splitPane(
    tabId: string,
    targetPaneId: string,
    direction: SplitDirection,
    host?: HostSummary
  ) {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (!tab) return;

    function replaceNode(node: PaneNode): PaneNode {
      if (node.type === "leaf") {
        if (node.id === targetPaneId) {
          const newLeafId = generateId();
          const newLeafTitle = host ? host.label : "Local Shell";

          const newLeaf: LeafPane = {
            type: "leaf",
            id: newLeafId,
            title: newLeafTitle,
            hostId: host?.id,
            host,
          };

          tab!.activePaneId = newLeafId;

          return {
            type: "split",
            id: generateId(),
            direction,
            first: node,
            second: newLeaf,
            ratio: 0.5,
          };
        }
        return node;
      } else {
        return {
          ...node,
          first: replaceNode(node.first),
          second: replaceNode(node.second),
        };
      }
    }

    tab.rootPane = replaceNode(tab.rootPane);
  }

  function dockTabIntoPane(
    sourceTabId: string,
    targetTabId: string,
    targetPaneId: string,
    direction: SplitDirection
  ) {
    const targetTab = tabs.value.find((t) => t.id === targetTabId);
    const sourceTab = tabs.value.find((t) => t.id === sourceTabId);
    if (!targetTab || !sourceTab) return;

    function replaceNode(node: PaneNode): PaneNode {
      if (node.type === "leaf") {
        if (node.id === targetPaneId) {
          return {
            type: "split",
            id: generateId(),
            direction,
            first: node,
            second: sourceTab!.rootPane,
            ratio: 0.5,
          };
        }
        return node;
      } else {
        return {
          ...node,
          first: replaceNode(node.first),
          second: replaceNode(node.second),
        };
      }
    }

    targetTab.rootPane = replaceNode(targetTab.rootPane);
    targetTab.activePaneId = sourceTab.activePaneId;

    // Remove source tab from tabs list
    const sourceIdx = tabs.value.findIndex((t) => t.id === sourceTabId);
    if (sourceIdx !== -1) {
      tabs.value.splice(sourceIdx, 1);
    }
    activeTabId.value = targetTabId;
  }

  function closePane(tabId: string, targetPaneId: string) {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.rootPane.type === "leaf" && tab.rootPane.id === targetPaneId) {
      closeTab(tabId);
      return;
    }

    function removeNode(node: PaneNode): PaneNode | null {
      if (node.type === "leaf") {
        return node.id === targetPaneId ? null : node;
      }

      const firstRes = removeNode(node.first);
      const secondRes = removeNode(node.second);

      if (firstRes === null) return secondRes;
      if (secondRes === null) return firstRes;

      return {
        ...node,
        first: firstRes,
        second: secondRes,
      };
    }

    const newRoot = removeNode(tab.rootPane);
    if (newRoot) {
      tab.rootPane = newRoot;
    } else {
      closeTab(tabId);
    }
  }

  function setActivePane(tabId: string, paneId: string) {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (tab) {
      tab.activePaneId = paneId;
    }
  }

  return {
    tabs,
    activeTabId,
    isBroadcastMode,
    paneSessionMap,
    registerPaneSession,
    unregisterPaneSession,
    toggleBroadcastMode,
    getLeafPanesInTab,
    broadcastData,
    createTab,
    closeTab,
    splitPane,
    dockTabIntoPane,
    closePane,
    setActivePane,
  };
});
