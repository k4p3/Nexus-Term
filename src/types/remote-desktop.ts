import type { HostProtocol } from "./inventory";

export type RdState = "connecting" | "connected" | "disconnected" | "error";

export type InputEvent =
  | { type: "key"; scancode: number; extended: boolean; down: boolean; keysym?: number | null }
  | { type: "pointer"; x: number; y: number; buttons: number }
  | { type: "wheel"; x: number; y: number; dx: number; dy: number };

/** Eventos de ciclo de vida emitidos por el backend (`rd://{id}/event`). */
export type RdSessionEvent =
  | { type: "state"; state: RdState }
  | { type: "clipboard"; text: string }
  | { type: "cert_prompt"; fingerprint: string; changed: boolean }
  | { type: "error"; message: string };

export interface RdConnectInfo {
  session_id: string;
  protocol: HostProtocol;
  unencrypted_warning: boolean;
}

export interface CertPrompt {
  fingerprint: string;
  changed: boolean;
}

export interface RdSession {
  sessionId: string;
  hostId: string;
  protocol: HostProtocol;
  state: RdState;
  error: string | null;
  certPrompt: CertPrompt | null;
  unencryptedWarning: boolean;
  /** Último texto recibido del portapapeles remoto. */
  remoteClipboard: string | null;
}

export const FRAME_KIND_RECT = 0;
export const FRAME_KIND_RESIZE = 1;
export const FRAME_KIND_CURSOR = 2;

export interface DecodedFrame {
  kind: number;
  x: number;
  y: number;
  w: number;
  h: number;
  payload: Uint8Array;
}
