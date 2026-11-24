import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { HostSummary } from "../types/inventory";
import type { SessionTab, PaneNode, LeafPane, SplitDirection, SplitPlacement } from "../types/session";
import { sessionService } from "../services/session.service";
import { buildRestoredTabs, type SessionLayout } from "../utils/session-layout";
import { findNeighborPane, type FocusDirection } from "../utils/pane-navigation";

function generateId(): string {
  return "pane-" + Math.random().toString(36).substring(2, 9);
}

const MIN_SPLIT_RATIO = 0.1;
const MAX_SPLIT_RATIO = 0.9;

export const useSessionsStore = defineStore("sessions", () => {
  const tabs = ref<SessionTab[]>([]);
  const activeTabId = ref<string | null>(null);
  const isBroadcastMode = ref(false);
  const paneSessionMap = ref<Record<string, string>>({});

  // Una pestaña restaurada conecta solo al activarse por primera vez (conexión diferida).
  watch(
    activeTabId,
    (id) => {
      const tab = tabs.value.find((t) => t.id === id);
      if (tab?.pending) tab.pending = false;
    },
    { flush: "sync" },
  );

  /** Activa la pestaña siguiente (+1) o anterior (-1) de forma cíclica; sin efecto con menos de 2 pestañas. */
  function activateAdjacentTab(delta: 1 | -1) {
    const n = tabs.value.length;
    if (n < 2) return;
    const idx = tabs.value.findIndex((t) => t.id === activeTabId.value);
    const next = idx === -1 ? (delta === 1 ? 0 : n - 1) : (idx + delta + n) % n;
    activeTabId.value = tabs.value[next].id;
  }

  /** Activa la pestaña en la posición `index` (base 0); fuera de rango no hace nada. */
  function activateTabByIndex(index: number) {
    const tab = tabs.value[index];
    if (tab) activeTabId.value = tab.id;
  }

  /** Reconstruye las pestañas de un layout guardado. Devuelve cuántas se restauraron y los paneles omitidos. */
  function restoreLayout(layout: SessionLayout, hosts: HostSummary[]): { restored: number; skipped: string[] } {
    const r = buildRestoredTabs(layout, hosts, (prefix) =>
      prefix === "tab" ? "tab-" + Math.random().toString(36).substring(2, 9) : generateId(),
    );
    if (r.tabs.length === 0) return { restored: 0, skipped: r.skipped };
    tabs.value.push(...r.tabs);
    activeTabId.value = r.activeTabId; // al activarla se limpia su estado pendiente
    return { restored: r.tabs.length, skipped: r.skipped };
  }

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
    host?: HostSummary,
    placement: SplitPlacement = "after",
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
            first: placement === "before" ? newLeaf : node,
            second: placement === "before" ? node : newLeaf,
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
    direction: SplitDirection,
    placement: SplitPlacement = "after",
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
            first: placement === "before" ? sourceTab!.rootPane : node,
            second: placement === "before" ? node : sourceTab!.rootPane,
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

  function setSplitRatio(tabId: string, splitId: string, ratio: number) {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (!tab || !Number.isFinite(ratio)) return;
    const clamped = Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));

    function update(node: PaneNode): PaneNode {
      if (node.type === "leaf") return node;
      if (node.id === splitId) {
        return { ...node, ratio: clamped };
      }
      return {
        ...node,
        first: update(node.first),
        second: update(node.second),
      };
    }

    tab.rootPane = update(tab.rootPane);
  }

  function closePane(tabId: string, targetPaneId: string) {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.rootPane.type === "leaf" && tab.rootPane.id === targetPaneId) {
      closeTab(tabId);
      return;
    }

    function firstLeafId(node: PaneNode): string {
      return node.type === "leaf" ? node.id : firstLeafId(node.first);
    }

    function lastLeafId(node: PaneNode): string {
      return node.type === "leaf" ? node.id : lastLeafId(node.second);
    }

    let siblingActiveId: string | null = null;

    function removeNode(node: PaneNode): PaneNode | null {
      if (node.type === "leaf") {
        return node.id === targetPaneId ? null : node;
      }

      const firstRes = removeNode(node.first);
      const secondRes = removeNode(node.second);

      if (firstRes === null && secondRes !== null) {
        siblingActiveId ??= firstLeafId(secondRes);
        return secondRes;
      }
      if (secondRes === null && firstRes !== null) {
        siblingActiveId ??= lastLeafId(firstRes);
        return firstRes;
      }
      if (firstRes === null && secondRes === null) return null;

      return {
        ...node,
        first: firstRes!,
        second: secondRes!,
      };
    }

    const newRoot = removeNode(tab.rootPane);
    if (newRoot) {
      tab.rootPane = newRoot;
      const remaining = getLeafPanesInTab(tabId);
      if (!remaining.some((l) => l.id === tab.activePaneId)) {
        tab.activePaneId =
          siblingActiveId && remaining.some((l) => l.id === siblingActiveId)
            ? siblingActiveId
            : (remaining[0]?.id ?? "");
      }
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

  /** Mueve el panel activo al contiguo en `dir`. Devuelve `false` (sin cambios) si no hay ninguno. */
  function focusNeighborPane(tabId: string, dir: FocusDirection): boolean {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (!tab) return false;
    const target = findNeighborPane(tab.rootPane, tab.activePaneId, dir);
    if (!target) return false;
    tab.activePaneId = target;
    return true;
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
    restoreLayout,
    closeTab,
    activateAdjacentTab,
    activateTabByIndex,
    splitPane,
    dockTabIntoPane,
    setSplitRatio,
    closePane,
    setActivePane,
    focusNeighborPane,
  };
});
