import { defineStore } from "pinia";
import { ref } from "vue";
import type { SystemTelemetrySnapshot } from "../types/telemetry";
import { telemetryService } from "../services/telemetry.service";

export const useTelemetryStore = defineStore("telemetry", () => {
  const activeStreams = ref<Record<string, string>>({}); // hostId -> streamId
  const currentSnapshots = ref<Record<string, SystemTelemetrySnapshot>>({}); // hostId -> snapshot
  const history = ref<Record<string, SystemTelemetrySnapshot[]>>({}); // hostId -> array of snapshots
  const isTelemetryVisible = ref<Record<string, boolean>>({}); // paneId -> boolean
  const defaultIntervalSecs = ref(2);
  const isPaused = ref<Record<string, boolean>>({}); // hostId -> boolean
  const error = ref<string | null>(null);

  const MAX_HISTORY_POINTS = 30;

  async function startMonitoring(hostId: string, intervalSecs?: number): Promise<string | null> {
    if (activeStreams.value[hostId]) {
      return activeStreams.value[hostId];
    }

    try {
      error.value = null;
      const interval = intervalSecs || defaultIntervalSecs.value;

      const streamId = await telemetryService.startStream(
        hostId,
        interval,
        (snapshot: SystemTelemetrySnapshot) => {
          if (isPaused.value[hostId]) return;

          currentSnapshots.value[hostId] = snapshot;

          if (!history.value[hostId]) {
            history.value[hostId] = [];
          }
          history.value[hostId].push(snapshot);
          if (history.value[hostId].length > MAX_HISTORY_POINTS) {
            history.value[hostId].shift();
          }
        }
      );

      activeStreams.value[hostId] = streamId;
      return streamId;
    } catch (err: any) {
      error.value = String(err);
      console.error("Failed to start telemetry stream:", err);
      return null;
    }
  }

  async function stopMonitoring(hostId: string): Promise<void> {
    const streamId = activeStreams.value[hostId];
    if (!streamId) return;

    try {
      await telemetryService.stopStream(streamId);
    } catch (err) {
      console.error("Failed to stop telemetry stream:", err);
    } finally {
      delete activeStreams.value[hostId];
    }
  }

  function togglePaneTelemetry(paneId: string, hostId?: string) {
    const willBeVisible = !isTelemetryVisible.value[paneId];
    isTelemetryVisible.value[paneId] = willBeVisible;

    if (willBeVisible && hostId) {
      startMonitoring(hostId);
    }
  }

  function togglePause(hostId: string) {
    isPaused.value[hostId] = !isPaused.value[hostId];
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec === 0) return "0 B/s";
    const k = 1024;
    const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
    const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
    return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatUptime(seconds: number): string {
    if (seconds === 0) return "0m";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  return {
    activeStreams,
    currentSnapshots,
    history,
    isTelemetryVisible,
    defaultIntervalSecs,
    isPaused,
    error,
    startMonitoring,
    stopMonitoring,
    togglePaneTelemetry,
    togglePause,
    formatBytes,
    formatSpeed,
    formatUptime,
  };
});
