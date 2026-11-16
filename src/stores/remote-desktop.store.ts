import { defineStore } from "pinia";
import { ref } from "vue";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { newSessionId, remoteDesktopService } from "../services/remote-desktop.service";
import type { InputEvent, RdSession, RdSessionEvent } from "../types/remote-desktop";

function errMsg(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
}

export const useRemoteDesktopStore = defineStore("remote-desktop", () => {
  /** Sesiones por clave de panel (`paneId`). */
  const sessions = ref<Record<string, RdSession>>({});
  const listeners = new Map<string, UnlistenFn>();

  function applyEvent(key: string, ev: RdSessionEvent) {
    const s = sessions.value[key];
    if (!s) return;
    switch (ev.type) {
      case "state":
        s.state = ev.state;
        if (ev.state === "connected") {
          s.error = null;
          s.certPrompt = null;
        }
        break;
      case "error":
        s.error = ev.message;
        break;
      case "cert_prompt":
        s.certPrompt = { fingerprint: ev.fingerprint, changed: ev.changed };
        break;
      case "clipboard":
        s.remoteClipboard = ev.text;
        break;
    }
  }

  async function cleanupListener(key: string) {
    const un = listeners.get(key);
    if (un) {
      listeners.delete(key);
      un();
    }
  }

  /** Conecta un panel a un host gráfico. Reintentable: cierra antes cualquier sesión previa del panel. */
  async function connect(
    key: string,
    hostId: string,
    width: number,
    height: number,
    onFrame: (frame: ArrayBuffer) => void,
  ): Promise<void> {
    if (sessions.value[key]) await disconnect(key);
    const sessionId = newSessionId();
    sessions.value[key] = {
      sessionId,
      hostId,
      protocol: "rdp",
      state: "connecting",
      error: null,
      certPrompt: null,
      unencryptedWarning: false,
      remoteClipboard: null,
    };
    try {
      // Suscribirse antes de conectar para no perder los primeros eventos.
      listeners.set(key, await remoteDesktopService.onEvent(sessionId, (ev) => applyEvent(key, ev)));
      const info = await remoteDesktopService.connect(sessionId, hostId, width, height, onFrame);
      const s = sessions.value[key];
      if (s) {
        s.protocol = info.protocol;
        s.unencryptedWarning = info.unencrypted_warning;
      }
    } catch (e) {
      const s = sessions.value[key];
      if (s) {
        s.state = "error";
        s.error = errMsg(e);
      }
      await cleanupListener(key);
    }
  }

  async function sendInput(key: string, event: InputEvent) {
    const s = sessions.value[key];
    if (!s || s.state !== "connected") return;
    try {
      await remoteDesktopService.sendInput(s.sessionId, event);
    } catch (e) {
      console.error("rd input error:", errMsg(e));
    }
  }

  async function sendCtrlAltDel(key: string) {
    const s = sessions.value[key];
    if (s?.state === "connected") await remoteDesktopService.sendCtrlAltDel(s.sessionId);
  }

  async function setClipboard(key: string, text: string) {
    const s = sessions.value[key];
    if (s?.state !== "connected") return;
    try {
      await remoteDesktopService.setClipboard(s.sessionId, text);
    } catch (e) {
      s.error = errMsg(e);
    }
  }

  async function resolveCert(key: string, accept: boolean) {
    const s = sessions.value[key];
    if (!s?.certPrompt) return;
    s.certPrompt = null;
    try {
      await remoteDesktopService.acceptCert(s.sessionId, accept);
    } catch (e) {
      s.state = "error";
      s.error = errMsg(e);
    }
  }

  async function disconnect(key: string) {
    const s = sessions.value[key];
    if (!s) return;
    try {
      await remoteDesktopService.disconnect(s.sessionId);
    } catch {
      /* ya cerrada */
    }
    await cleanupListener(key);
    delete sessions.value[key];
  }

  return { sessions, connect, sendInput, sendCtrlAltDel, setClipboard, resolveCert, disconnect };
});
