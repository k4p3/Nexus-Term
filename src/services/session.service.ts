import { invoke, Channel } from "@tauri-apps/api/core";

export interface GeneratedSshKey {
  private_key: string;
  public_key: string;
  fingerprint: string;
}

export const sessionService = {
  async generateSshKey(algorithm?: string): Promise<GeneratedSshKey> {
    return await invoke<GeneratedSshKey>("generate_ssh_key", { algorithm });
  },
  async openLocalPty(
    cols: number,
    rows: number,
    onData: (data: Uint8Array) => void
  ): Promise<string> {
    const channel = new Channel<number[]>();
    channel.onmessage = (chunk: number[]) => {
      onData(new Uint8Array(chunk));
    };

    return await invoke<string>("open_local_pty", {
      cols,
      rows,
      onData: channel,
    });
  },

  async connectSsh(
    hostId: string,
    cols: number,
    rows: number,
    onData: (data: Uint8Array) => void
  ): Promise<string> {
    const channel = new Channel<number[]>();
    channel.onmessage = (chunk: number[]) => {
      onData(new Uint8Array(chunk));
    };

    return await invoke<string>("connect_ssh", {
      hostId,
      cols,
      rows,
      onData: channel,
    });
  },

  async writeSession(sessionId: string, data: Uint8Array): Promise<void> {
    await invoke("write_session", {
      sessionId,
      data: Array.from(data),
    });
  },

  async resizeSession(sessionId: string, cols: number, rows: number): Promise<void> {
    await invoke("resize_session", {
      sessionId,
      cols,
      rows,
    });
  },

  async closeSession(sessionId: string): Promise<void> {
    await invoke("close_session", { sessionId });
  },
};
