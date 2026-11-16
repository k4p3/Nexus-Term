import { describe, it, expect } from "vitest";
import {
  serializeLayout, parseLayout, buildRestoredTabs, decideRestoreAction, layoutTabCount, MAX_LAYOUT_TABS, MAX_PANES_PER_TAB,
} from "./session-layout";
import type { SessionTab, LeafPane } from "../types/session";
import type { HostSummary } from "../types/inventory";

const host = (id: string, protocol: "ssh" | "rdp" | "vnc" = "ssh"): HostSummary => ({
  id, folder_id: null, jump_host_id: null, protocol, label: `Host ${id}`, hostname: `${id}.secret.example.com`,
  port: 22, username_override: "svc-account", identity_id: "ident-1", tags: [], notes: "private notes", updated_at: "x",
});
const leaf = (id: string, h?: HostSummary): LeafPane => ({ type: "leaf", id, title: h?.label ?? "Local Shell", hostId: h?.id, host: h });

let n = 0;
const gen = (p: string) => `${p}-${++n}`;

function sampleTabs(): SessionTab[] {
  const a = host("a"), r = host("r", "rdp");
  return [
    { id: "t1", title: "Host a", rootPane: leaf("p1", a), activePaneId: "p1" },
    {
      id: "t2", title: "Mixed", activePaneId: "p4",
      rootPane: { type: "split", id: "s1", direction: "horizontal", ratio: 0.3, first: leaf("p3"), second: leaf("p4", r) },
    },
  ];
}

describe("serializeLayout", () => {
  it("captures structure, titles, ratios and host ids", () => {
    const l = serializeLayout(sampleTabs(), "t2");
    expect(l.active_tab).toBe(1);
    expect(l.tabs[0].root).toEqual({ type: "leaf", kind: "host", host_id: "a", title: "Host a" });
    expect(l.tabs[1].root).toMatchObject({ type: "split", direction: "horizontal", ratio: 0.3 });
    expect(l.tabs[1].active_leaf).toBe(1);
  });

  it("never contains hostnames, identities, notes or other sensitive data", () => {
    const json = JSON.stringify(serializeLayout(sampleTabs(), "t1"));
    for (const secret of ["secret.example.com", "ident-1", "private notes", "svc-account", "username"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("marks shells without host as local and caps the number of tabs", () => {
    const l = serializeLayout(sampleTabs(), null);
    expect(l.tabs[1].root).toMatchObject({ first: { kind: "local" } });
    const many = Array.from({ length: MAX_LAYOUT_TABS + 5 }, (_, i): SessionTab => ({
      id: `t${i}`, title: "x", rootPane: leaf(`p${i}`), activePaneId: `p${i}`,
    }));
    expect(serializeLayout(many, null).tabs).toHaveLength(MAX_LAYOUT_TABS);
  });

  it("serializes an empty workspace", () => {
    expect(serializeLayout([], null).tabs).toEqual([]);
  });
});

describe("parseLayout", () => {
  it("round-trips a serialized layout", () => {
    const l = serializeLayout(sampleTabs(), "t2");
    expect(parseLayout(JSON.stringify(l))).toEqual(l);
  });

  it("rejects invalid, empty or foreign data", () => {
    for (const bad of [null, undefined, "", "not json", "[]", "42", '{"version":2,"tabs":[]}', '{"version":1}']) {
      expect(parseLayout(bad as string | null)).toBeNull();
    }
  });

  it("drops malformed tabs and clamps values", () => {
    const json = JSON.stringify({
      version: 1, active_tab: 99,
      tabs: [
        { title: "ok", active_leaf: -4, root: { type: "split", direction: "vertical", ratio: 7,
          first: { type: "leaf", kind: "local", title: "a" }, second: { type: "leaf", kind: "host", host_id: "h", title: "b" } } },
        { title: "bad", root: { type: "weird" } },
        "junk",
      ],
    });
    const l = parseLayout(json)!;
    expect(l.tabs).toHaveLength(1);
    expect(l.active_tab).toBe(0);
    expect(l.tabs[0].active_leaf).toBe(0);
    expect(l.tabs[0].root).toMatchObject({ ratio: 0.9 });
  });

  it("treats a host leaf without id as a local shell", () => {
    const l = parseLayout(JSON.stringify({ version: 1, active_tab: 0, tabs: [{ title: "t", active_leaf: 0, root: { type: "leaf", kind: "host", title: "x" } }] }))!;
    expect(l.tabs[0].root).toMatchObject({ kind: "local" });
  });

  it("limits panes per tab and nesting depth", () => {
    let node: unknown = { type: "leaf", kind: "local", title: "x" };
    for (let i = 0; i < MAX_PANES_PER_TAB + 10; i++) {
      node = { type: "split", direction: "horizontal", ratio: 0.5, first: node, second: { type: "leaf", kind: "local", title: "y" } };
    }
    const l = parseLayout(JSON.stringify({ version: 1, active_tab: 0, tabs: [{ title: "t", active_leaf: 0, root: node }] }));
    expect(l === null || l.tabs.length <= 1).toBe(true);
  });
});

describe("decideRestoreAction", () => {
  const layout = serializeLayout(sampleTabs(), "t1");
  it("asks, restores automatically or does nothing depending on mode", () => {
    expect(decideRestoreAction("ask", layout, 0)).toBe("prompt");
    expect(decideRestoreAction("auto", layout, 0)).toBe("auto");
    expect(decideRestoreAction("off", layout, 0)).toBe("none");
  });
  it("does nothing without a saved layout or when tabs are already open", () => {
    expect(decideRestoreAction("ask", null, 0)).toBe("none");
    expect(decideRestoreAction("ask", { ...layout, tabs: [] }, 0)).toBe("none");
    expect(decideRestoreAction("auto", layout, 2)).toBe("none");
  });
  it("treats unknown modes as ask", () => {
    expect(decideRestoreAction("bogus", layout, 0)).toBe("prompt");
  });
  it("counts tabs", () => {
    expect(layoutTabCount(layout)).toBe(2);
    expect(layoutTabCount(null)).toBe(0);
  });
});

describe("buildRestoredTabs", () => {
  const hosts = [host("a"), host("r", "rdp")];

  it("rebuilds tabs as pending with fresh ids and the saved active tab/pane", () => {
    const layout = serializeLayout(sampleTabs(), "t2");
    const r = buildRestoredTabs(layout, hosts, gen);
    expect(r.tabs).toHaveLength(2);
    expect(r.tabs.every((t) => t.pending)).toBe(true);
    expect(r.activeTabId).toBe(r.tabs[1].id);
    const split = r.tabs[1].rootPane;
    expect(split.type).toBe("split");
    if (split.type === "split" && split.second.type === "leaf") {
      expect(r.tabs[1].activePaneId).toBe(split.second.id);
      expect(split.ratio).toBe(0.3);
      expect(split.second.host?.protocol).toBe("rdp"); // panel gráfico recuperado como tal
    }
    expect(r.skipped).toEqual([]);
  });

  it("opens a fresh local shell for local panes without restoring contents", () => {
    const layout = serializeLayout(sampleTabs(), "t2");
    const r = buildRestoredTabs(layout, hosts, gen);
    const split = r.tabs[1].rootPane;
    if (split.type === "split" && split.first.type === "leaf") {
      expect(split.first.hostId).toBeUndefined();
      expect(split.first.host).toBeUndefined();
      expect(split.first.sessionId).toBeUndefined();
    }
  });

  it("skips panes whose host no longer exists and reports them", () => {
    const layout = serializeLayout(sampleTabs(), "t1");
    const r = buildRestoredTabs(layout, [host("r", "rdp")], gen);
    expect(r.tabs).toHaveLength(1); // la pestaña de "a" desaparece
    expect(r.skipped).toEqual(["Host a"]);
    expect(r.activeTabId).toBe(r.tabs[0].id);
  });

  it("collapses a split when only one side survives", () => {
    const layout = serializeLayout(sampleTabs(), "t2");
    const r = buildRestoredTabs(layout, [], gen); // ningún host existe; queda el shell local
    expect(r.tabs).toHaveLength(1);
    expect(r.tabs[0].rootPane.type).toBe("leaf");
    expect(r.skipped).toEqual(["Host a", "Host r"]);
    expect(r.tabs[0].activePaneId).toBe((r.tabs[0].rootPane as LeafPane).id);
  });

  it("returns nothing when no pane can be restored", () => {
    const layout = serializeLayout([sampleTabs()[0]], "t1");
    const r = buildRestoredTabs(layout, [], gen);
    expect(r.tabs).toEqual([]);
    expect(r.activeTabId).toBeNull();
    expect(r.skipped).toHaveLength(1);
  });
});
