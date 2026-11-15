import { invoke, Channel } from "@tauri-apps/api/core";
import type { SystemTelemetrySnapshot } from "../types/telemetry";

export const telemetryService = {
  async fetchSnapshot(hostId: string): Promise<SystemTelemetrySnapshot> {
    return await invoke<SystemTelemetrySnapshot>("fetch_telemetry_snapshot", {
      hostId,
    });
  },

  async startStream(
    hostId: string,
    intervalSecs: number,
    onSnapshot: (snapshot: SystemTelemetrySnapshot) => void
  ): Promise<string> {
    const channel = new Channel<SystemTelemetrySnapshot>();
    channel.onmessage = (snapshot: SystemTelemetrySnapshot) => {
      onSnapshot(snapshot);
    };

    return await invoke<string>("start_telemetry_stream", {
      hostId,
      intervalSecs,
      channel,
    });
  },

  async stopStream(streamId: string): Promise<void> {
    return await invoke<void>("stop_telemetry_stream", {
      streamId,
    });
  },
};
