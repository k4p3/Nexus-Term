import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";

vi.mock("../services/session.service", () => ({ sessionService: { writeSession: vi.fn() } }));

import { useSessionsStore } from "./sessions.store";
import { serializeLayout } from "../utils/session-layout";
import type { HostSummary } from "../types/inventory";

const host = (id: string, protocol: "ssh" | "rdp" | "vnc" = "ssh"): HostSummary => ({
  id, folder_id: null, jump_host_id: null, protocol, label: `H-${id}`, hostname: "h", port: 22,
  username_override: null, identity_id: null, tags: [], notes: null, updated_at: "x",
});

function savedLayout() {
  const s = useSessionsStore();
  s.createTab("one", host("a"));
  s.createTab("two", host("b"));
  s.createTab("local");
  const layout = serializeLayout(s.tabs, s.tabs[1].id);
  s.tabs.splice(0, s.tabs.length);
  s.activeTabId = null;
  return layout;
}

describe("sessions store: restoreLayout", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("restores tabs as pending except the active one, which connects immediately", () => {
    const layout = savedLayout();
    const s = useSessionsStore();
    const r = s.restoreLayout(layout, [host("a"), host("b")]);
    expect(r.restored).toBe(3);
    expect(s.tabs).toHaveLength(3);
    expect(s.activeTabId).toBe(s.tabs[1].id);
    expect(s.tabs[1].pending).toBe(false);
    expect(s.tabs[0].pending).toBe(true);
    expect(s.tabs[2].pending).toBe(true);
  });

  it("connects a pending tab only when it becomes active", () => {
    const layout = savedLayout();
    const s = useSessionsStore();
    s.restoreLayout(layout, [host("a"), host("b")]);
    const first = s.tabs[0];
    expect(first.pending).toBe(true);
    s.activeTabId = first.id;
    expect(first.pending).toBe(false);
    expect(s.tabs[2].pending).toBe(true); // las demás siguen diferidas
  });

  it("skips missing hosts and reports them", () => {
    const layout = savedLayout();
    const s = useSessionsStore();
    const r = s.restoreLayout(layout, [host("a")]);
    expect(r.restored).toBe(2);
    expect(r.skipped).toEqual(["two"]);
  });

  it("does not touch state when nothing can be restored", () => {
    const layout = savedLayout();
    const s = useSessionsStore();
    s.createTab("existing");
    const before = s.activeTabId;
    const r = s.restoreLayout({ ...layout, tabs: layout.tabs.slice(0, 2) }, []);
    expect(r.restored).toBe(0);
    expect(s.tabs).toHaveLength(1);
    expect(s.activeTabId).toBe(before);
  });

  it("restores graphical hosts as panes carrying their rdp/vnc host", () => {
    const s = useSessionsStore();
    s.createTab("desk", host("r", "vnc"));
    const layout = serializeLayout(s.tabs, s.activeTabId);
    s.tabs.splice(0, 1);
    s.restoreLayout(layout, [host("r", "vnc")]);
    const pane = s.getLeafPanesInTab(s.tabs[0].id)[0];
    expect(pane.host?.protocol).toBe("vnc");
    void nextTick;
  });
});
