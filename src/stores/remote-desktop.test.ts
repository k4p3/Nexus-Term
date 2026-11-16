import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { RdSessionEvent } from "../types/remote-desktop";

let handler: ((ev: RdSessionEvent) => void) | null = null;
const unlisten = vi.fn();

vi.mock("../services/remote-desktop.service", () => ({
  newSessionId: () => "rd-test",
  remoteDesktopService: {
    onEvent: vi.fn(async (_id: string, h: (ev: RdSessionEvent) => void) => {
      handler = h;
      return unlisten;
    }),
    connect: vi.fn(async () => ({ session_id: "rd-test", protocol: "vnc", unencrypted_warning: true })),
    sendInput: vi.fn(async () => {}),
    sendCtrlAltDel: vi.fn(async () => {}),
    setClipboard: vi.fn(async () => {}),
    acceptCert: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    resize: vi.fn(async () => {}),
  },
}));

import { remoteDesktopService as svc } from "../services/remote-desktop.service";
import { useRemoteDesktopStore } from "./remote-desktop.store";

describe("remote desktop store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    handler = null;
    vi.clearAllMocks();
  });

  it("subscribes to events before connecting and records connect info", async () => {
    const store = useRemoteDesktopStore();
    const order: string[] = [];
    (svc.onEvent as any).mockImplementationOnce(async (_i: string, h: any) => {
      order.push("listen");
      handler = h;
      return unlisten;
    });
    (svc.connect as any).mockImplementationOnce(async () => {
      order.push("connect");
      return { session_id: "rd-test", protocol: "vnc", unencrypted_warning: true };
    });
    await store.connect("pane1", "host1", 800, 600, () => {});
    expect(order).toEqual(["listen", "connect"]);
    const s = store.sessions["pane1"];
    expect(s.protocol).toBe("vnc");
    expect(s.unencryptedWarning).toBe(true);
    expect(s.state).toBe("connecting");
  });

  it("applies lifecycle events", async () => {
    const store = useRemoteDesktopStore();
    await store.connect("p", "h", 1, 1, () => {});
    handler!({ type: "cert_prompt", fingerprint: "ab", changed: true });
    expect(store.sessions["p"].certPrompt).toEqual({ fingerprint: "ab", changed: true });
    handler!({ type: "state", state: "connected" });
    expect(store.sessions["p"].state).toBe("connected");
    expect(store.sessions["p"].certPrompt).toBeNull();
    handler!({ type: "clipboard", text: "hola" });
    expect(store.sessions["p"].remoteClipboard).toBe("hola");
    handler!({ type: "error", message: "boom" });
    handler!({ type: "state", state: "disconnected" });
    expect(store.sessions["p"].state).toBe("disconnected");
    expect(store.sessions["p"].error).toBe("boom");
  });

  it("marks the session as errored when connect fails and releases the listener", async () => {
    const store = useRemoteDesktopStore();
    (svc.connect as any).mockRejectedValueOnce("Fallo de autenticación: x");
    await store.connect("p", "h", 1, 1, () => {});
    expect(store.sessions["p"].state).toBe("error");
    expect(store.sessions["p"].error).toBe("Fallo de autenticación: x");
    expect(unlisten).toHaveBeenCalled();
  });

  it("only sends input while connected", async () => {
    const store = useRemoteDesktopStore();
    await store.connect("p", "h", 1, 1, () => {});
    const ev = { type: "pointer", x: 1, y: 2, buttons: 0 } as const;
    await store.sendInput("p", ev);
    expect(svc.sendInput).not.toHaveBeenCalled();
    handler!({ type: "state", state: "connected" });
    await store.sendInput("p", ev);
    expect(svc.sendInput).toHaveBeenCalledWith("rd-test", ev);
    await store.sendCtrlAltDel("p");
    expect(svc.sendCtrlAltDel).toHaveBeenCalledWith("rd-test");
  });

  it("resolves certificate prompts and clears them", async () => {
    const store = useRemoteDesktopStore();
    await store.connect("p", "h", 1, 1, () => {});
    handler!({ type: "cert_prompt", fingerprint: "ab", changed: false });
    await store.resolveCert("p", true);
    expect(svc.acceptCert).toHaveBeenCalledWith("rd-test", true);
    expect(store.sessions["p"].certPrompt).toBeNull();
  });

  it("surfaces clipboard errors without throwing", async () => {
    const store = useRemoteDesktopStore();
    await store.connect("p", "h", 1, 1, () => {});
    handler!({ type: "state", state: "connected" });
    (svc.setClipboard as any).mockRejectedValueOnce("desactivado");
    await store.setClipboard("p", "x");
    expect(store.sessions["p"].error).toBe("desactivado");
  });

  it("disconnect closes the session, removes it and unsubscribes", async () => {
    const store = useRemoteDesktopStore();
    await store.connect("p", "h", 1, 1, () => {});
    await store.disconnect("p");
    expect(svc.disconnect).toHaveBeenCalledWith("rd-test");
    expect(unlisten).toHaveBeenCalled();
    expect(store.sessions["p"]).toBeUndefined();
  });

  it("reconnecting a pane closes the previous session first", async () => {
    const store = useRemoteDesktopStore();
    await store.connect("p", "h", 1, 1, () => {});
    await store.connect("p", "h", 1, 1, () => {});
    expect(svc.disconnect).toHaveBeenCalledTimes(1);
    expect(store.sessions["p"]).toBeDefined();
  });
});
