import { invoke, Channel } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { InputEvent, RdConnectInfo, RdSessionEvent } from "../types/remote-desktop";

export function newSessionId(): string {
  return "rd-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const remoteDesktopService = {
  /** Suscribe a los eventos de una sesión (hacerlo ANTES de `connect`). */
  async onEvent(sessionId: string, handler: (ev: RdSessionEvent) => void): Promise<UnlistenFn> {
    return await listen<RdSessionEvent>(`rd://${sessionId}/event`, (e) => handler(e.payload));
  },

  async connect(
    sessionId: string,
    hostId: string,
    width: number,
    height: number,
    onFrame: (frame: ArrayBuffer) => void,
  ): Promise<RdConnectInfo> {
    const channel = new Channel<ArrayBuffer>();
    channel.onmessage = onFrame;
    return await invoke<RdConnectInfo>("rd_connect", {
      sessionId,
      hostId,
      width,
      height,
      onFrame: channel,
    });
  },

  async sendInput(sessionId: string, event: InputEvent): Promise<void> {
    await invoke("rd_send_input", { sessionId, event });
  },

  async resize(sessionId: string, width: number, height: number): Promise<void> {
    await invoke("rd_resize", { sessionId, width, height });
  },

  async sendCtrlAltDel(sessionId: string): Promise<void> {
    await invoke("rd_send_cad", { sessionId });
  },

  async setClipboard(sessionId: string, text: string): Promise<void> {
    await invoke("rd_set_clipboard", { sessionId, text });
  },

  async acceptCert(sessionId: string, accept: boolean): Promise<void> {
    await invoke("rd_accept_cert", { sessionId, accept });
  },

  async disconnect(sessionId: string): Promise<void> {
    await invoke("rd_disconnect", { sessionId });
  },
};
