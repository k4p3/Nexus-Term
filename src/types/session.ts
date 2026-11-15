import type { HostSummary } from "./inventory";

export type PaneType = "leaf" | "split";
export type SplitDirection = "horizontal" | "vertical";

export interface LeafPane {
  type: "leaf";
  id: string;
  title: string;
  sessionId?: string;
  hostId?: string;
  host?: HostSummary;
}

export interface SplitPane {
  type: "split";
  id: string;
  direction: SplitDirection;
  first: PaneNode;
  second: PaneNode;
  ratio: number; // e.g. 0.5
}

export type PaneNode = LeafPane | SplitPane;

export interface SessionTab {
  id: string;
  title: string;
  rootPane: PaneNode;
  activePaneId: string;
}
