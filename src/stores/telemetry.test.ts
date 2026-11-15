import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useTelemetryStore } from "./telemetry.store";
import { telemetryService } from "../services/telemetry.service";
import type { SystemTelemetrySnapshot } from "../types/telemetry";

vi.mock("../services/telemetry.service", () => ({
  telemetryService: {
    fetchSnapshot: vi.fn(),
    startStream: vi.fn(),
    stopStream: vi.fn(),
  },
}));

describe("telemetry store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const mockSnapshot: SystemTelemetrySnapshot = {
    timestamp_ms: 1000,
    cpu: {
      total_usage_percent: 45.5,
      cores_count: 8,
    },
    memory: {
      total_bytes: 16 * 1024 * 1024 * 1024,
      used_bytes: 8 * 1024 * 1024 * 1024,
      free_bytes: 4 * 1024 * 1024 * 1024,
      available_bytes: 8 * 1024 * 1024 * 1024,
      usage_percent: 50.0,
      swap_total_bytes: 4 * 1024 * 1024 * 1024,
      swap_used_bytes: 1 * 1024 * 1024 * 1024,
    },
    disk: {
      total_bytes: 500 * 1024 * 1024 * 1024,
      used_bytes: 200 * 1024 * 1024 * 1024,
      free_bytes: 300 * 1024 * 1024 * 1024,
      usage_percent: 40.0,
      mount_point: "/",
    },
    network: {
      rx_bytes_per_sec: 1024 * 50,
      tx_bytes_per_sec: 1024 * 10,
      total_rx_bytes: 5000000,
      total_tx_bytes: 1000000,
    },
    uptime_seconds: 90000,
    load_avg: [0.5, 0.8, 1.2],
  };

  it("should initialize with default state", () => {
    const store = useTelemetryStore();
    expect(store.activeStreams).toEqual({});
    expect(store.currentSnapshots).toEqual({});
    expect(store.history).toEqual({});
    expect(store.defaultIntervalSecs).toBe(2);
  });

  it("should correctly start monitoring and receive snapshots", async () => {
    let capturedCallback: ((snap: SystemTelemetrySnapshot) => void) | null = null;
    vi.mocked(telemetryService.startStream).mockImplementation(
      async (_hostId, _interval, onSnapshot) => {
        capturedCallback = onSnapshot;
        return "stream-123";
      }
    );

    const store = useTelemetryStore();
    const streamId = await store.startMonitoring("host-1", 2);

    expect(streamId).toBe("stream-123");
    expect(store.activeStreams["host-1"]).toBe("stream-123");
    expect(telemetryService.startStream).toHaveBeenCalledWith("host-1", 2, expect.any(Function));

    // Simulate snapshot callback
    if (capturedCallback) {
      (capturedCallback as (snap: SystemTelemetrySnapshot) => void)(mockSnapshot);
    }

    expect(store.currentSnapshots["host-1"]).toEqual(mockSnapshot);
    expect(store.history["host-1"]).toHaveLength(1);
    expect(store.history["host-1"][0]).toEqual(mockSnapshot);
  });

  it("should format bytes, speeds and uptime correctly", () => {
    const store = useTelemetryStore();

    expect(store.formatBytes(0)).toBe("0 B");
    expect(store.formatBytes(1024)).toBe("1 KB");
    expect(store.formatBytes(1024 * 1024 * 1024)).toBe("1 GB");

    expect(store.formatSpeed(0)).toBe("0 B/s");
    expect(store.formatSpeed(1024 * 500)).toBe("500 KB/s");
    expect(store.formatSpeed(1024 * 1024 * 5)).toBe("5 MB/s");

    expect(store.formatUptime(0)).toBe("0m");
    expect(store.formatUptime(120)).toBe("2m");
    expect(store.formatUptime(3660)).toBe("1h 1m");
    expect(store.formatUptime(90000)).toBe("1d 1h");
  });

  it("should stop monitoring and clean up active stream", async () => {
    vi.mocked(telemetryService.stopStream).mockResolvedValue(undefined);

    const store = useTelemetryStore();
    store.activeStreams["host-1"] = "stream-123";

    await store.stopMonitoring("host-1");

    expect(telemetryService.stopStream).toHaveBeenCalledWith("stream-123");
    expect(store.activeStreams["host-1"]).toBeUndefined();
  });

  it("should toggle pane telemetry visibility and pause/unpause", () => {
    const store = useTelemetryStore();

    expect(store.isTelemetryVisible["pane-1"]).toBeUndefined();
    store.togglePaneTelemetry("pane-1");
    expect(store.isTelemetryVisible["pane-1"]).toBe(true);
    store.togglePaneTelemetry("pane-1");
    expect(store.isTelemetryVisible["pane-1"]).toBe(false);

    expect(store.isPaused["host-1"]).toBeUndefined();
    store.togglePause("host-1");
    expect(store.isPaused["host-1"]).toBe(true);
    store.togglePause("host-1");
    expect(store.isPaused["host-1"]).toBe(false);
  });
});
