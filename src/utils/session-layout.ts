// Serialización y restauración del layout de pestañas/paneles.
// El JSON guardado contiene SOLO estructura, títulos e IDs de host: nunca credenciales,
// hostnames, contenido de terminal ni comandos.
import type { HostSummary } from "../types/inventory";
import type { PaneNode, LeafPane, SessionTab, SplitDirection } from "../types/session";

export const LAYOUT_VERSION = 1;
export const MAX_LAYOUT_TABS = 50;
export const MAX_PANES_PER_TAB = 32;
const MAX_DEPTH = 12;
const MAX_TITLE = 200;

export type RestoreMode = "ask" | "auto" | "off";

export type LayoutNode =
  | { type: "leaf"; kind: "local" | "host"; host_id?: string; title: string }
  | { type: "split"; direction: SplitDirection; ratio: number; first: LayoutNode; second: LayoutNode };

export interface LayoutTab {
  title: string;
  root: LayoutNode;
  /** Índice (recorrido en profundidad) del panel activo. */
  active_leaf: number;
}

export interface SessionLayout {
  version: number;
  active_tab: number;
  tabs: LayoutTab[];
}

// ---------- Serialización ----------

function serializeNode(node: PaneNode): LayoutNode {
  if (node.type === "leaf") {
    return node.hostId
      ? { type: "leaf", kind: "host", host_id: node.hostId, title: node.title }
      : { type: "leaf", kind: "local", title: node.title };
  }
  return {
    type: "split",
    direction: node.direction,
    ratio: node.ratio,
    first: serializeNode(node.first),
    second: serializeNode(node.second),
  };
}

function leafIds(node: PaneNode, out: string[] = []): string[] {
  if (node.type === "leaf") out.push(node.id);
  else {
    leafIds(node.first, out);
    leafIds(node.second, out);
  }
  return out;
}

export function serializeLayout(tabs: SessionTab[], activeTabId: string | null): SessionLayout {
  const list = tabs.slice(0, MAX_LAYOUT_TABS);
  const activeIdx = list.findIndex((t) => t.id === activeTabId);
  return {
    version: LAYOUT_VERSION,
    active_tab: activeIdx >= 0 ? activeIdx : 0,
    tabs: list.map((t) => ({
      title: t.title,
      root: serializeNode(t.rootPane),
      active_leaf: Math.max(0, leafIds(t.rootPane).indexOf(t.activePaneId)),
    })),
  };
}

// ---------- Lectura segura ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.slice(0, MAX_TITLE) : "");

function sanitizeNode(raw: unknown, depth: number, budget: { panes: number }): LayoutNode | null {
  if (!isObj(raw) || depth > MAX_DEPTH) return null;
  if (raw.type === "leaf") {
    if (budget.panes <= 0) return null;
    budget.panes--;
    const title = str(raw.title);
    if (raw.kind === "host" && typeof raw.host_id === "string" && raw.host_id) {
      return { type: "leaf", kind: "host", host_id: raw.host_id, title };
    }
    return { type: "leaf", kind: "local", title };
  }
  if (raw.type === "split" && (raw.direction === "horizontal" || raw.direction === "vertical")) {
    const first = sanitizeNode(raw.first, depth + 1, budget);
    const second = sanitizeNode(raw.second, depth + 1, budget);
    if (!first || !second) return first ?? second;
    const r = typeof raw.ratio === "number" && Number.isFinite(raw.ratio) ? raw.ratio : 0.5;
    return { type: "split", direction: raw.direction, ratio: Math.min(0.9, Math.max(0.1, r)), first, second };
  }
  return null;
}

/** Interpreta el JSON guardado. Devuelve `null` si no es un layout utilizable. */
export function parseLayout(json: string | null | undefined): SessionLayout | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.version !== LAYOUT_VERSION || !Array.isArray(raw.tabs)) return null;
  const tabs: LayoutTab[] = [];
  for (const t of raw.tabs.slice(0, MAX_LAYOUT_TABS)) {
    if (!isObj(t)) continue;
    const root = sanitizeNode(t.root, 0, { panes: MAX_PANES_PER_TAB });
    if (!root) continue;
    tabs.push({
      title: str(t.title),
      root,
      active_leaf: typeof t.active_leaf === "number" && t.active_leaf >= 0 ? Math.floor(t.active_leaf) : 0,
    });
  }
  const active = typeof raw.active_tab === "number" ? Math.floor(raw.active_tab) : 0;
  return { version: LAYOUT_VERSION, active_tab: active >= 0 && active < tabs.length ? active : 0, tabs };
}

export function layoutTabCount(layout: SessionLayout | null): number {
  return layout?.tabs.length ?? 0;
}

function nodeHasHost(node: LayoutNode): boolean {
  return node.type === "leaf" ? node.kind === "host" : nodeHasHost(node.first) || nodeHasHost(node.second);
}

/** Indica si algún panel del layout es de un host guardado (y por tanto necesita la bóveda para restaurarse). */
export function layoutHasHostLeaf(layout: SessionLayout | null): boolean {
  return !!layout && layout.tabs.some((t) => nodeHasHost(t.root));
}

// ---------- Restauración ----------

export type RestoreAction = "prompt" | "auto" | "none";

/** Decide qué hacer al desbloquear la bóveda según el modo y si hay algo que restaurar. */
export function decideRestoreAction(mode: string, layout: SessionLayout | null, openTabs: number): RestoreAction {
  if (mode === "off" || openTabs > 0 || layoutTabCount(layout) === 0) return "none";
  return mode === "auto" ? "auto" : "prompt";
}

export interface RestoredTabs {
  tabs: SessionTab[];
  activeTabId: string | null;
  /** Etiquetas de los paneles omitidos porque su host ya no existe. */
  skipped: string[];
}

interface BuildCtx {
  hosts: Map<string, HostSummary>;
  genId: (prefix: "tab" | "pane") => string;
  skipped: string[];
  leafCounter: number;
  activeLeafIndex: number;
  activePaneId: string | null;
  firstPaneId: string | null;
}

function buildNode(node: LayoutNode, ctx: BuildCtx): PaneNode | null {
  if (node.type === "leaf") {
    const index = ctx.leafCounter++;
    let host: HostSummary | undefined;
    if (node.kind === "host") {
      host = ctx.hosts.get(node.host_id ?? "");
      if (!host) {
        ctx.skipped.push(node.title || node.host_id || "?");
        return null;
      }
    }
    const leaf: LeafPane = {
      type: "leaf",
      id: ctx.genId("pane"),
      title: host?.label ?? (node.title || "Local Shell"),
      hostId: host?.id,
      host,
    };
    ctx.firstPaneId ??= leaf.id;
    if (index === ctx.activeLeafIndex) ctx.activePaneId = leaf.id;
    return leaf;
  }
  const first = buildNode(node.first, ctx);
  const second = buildNode(node.second, ctx);
  if (!first || !second) return first ?? second; // un lado omitido: el otro ocupa su lugar
  return { type: "split", id: ctx.genId("pane"), direction: node.direction, ratio: node.ratio, first, second };
}

/**
 * Reconstruye las pestañas. Los paneles gráficos (RDP/VNC) se recuperan como tales porque su
 * componente se elige por el protocolo del host. Los hosts inexistentes se omiten.
 */
export function buildRestoredTabs(
  layout: SessionLayout,
  hosts: HostSummary[],
  genId: (prefix: "tab" | "pane") => string,
): RestoredTabs {
  const hostMap = new Map(hosts.map((h) => [h.id, h]));
  const skipped: string[] = [];
  const tabs: SessionTab[] = [];
  let activeTabId: string | null = null;

  layout.tabs.forEach((lt, i) => {
    const ctx: BuildCtx = {
      hosts: hostMap,
      genId,
      skipped,
      leafCounter: 0,
      activeLeafIndex: lt.active_leaf,
      activePaneId: null,
      firstPaneId: null,
    };
    const root = buildNode(lt.root, ctx);
    if (!root) return; // todos sus paneles faltaban
    const tab: SessionTab = {
      id: genId("tab"),
      title: lt.title || (root.type === "leaf" ? root.title : "Session"),
      rootPane: root,
      activePaneId: ctx.activePaneId ?? ctx.firstPaneId ?? "",
      pending: true, // conecta al activarse por primera vez
    };
    tabs.push(tab);
    if (i === layout.active_tab) activeTabId = tab.id;
  });

  if (!activeTabId && tabs.length > 0) activeTabId = tabs[0].id;
  return { tabs, activeTabId, skipped };
}
