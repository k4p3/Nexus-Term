import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useTunnelsStore } from "./tunnels.store";
import { tunnelsService } from "../services/tunnels.service";

vi.mock("../services/tunnels.service", () => ({
  tunnelsService: {
    listTunnels: vi.fn(),
    saveTunnel: vi.fn(),
    deleteTunnel: vi.fn(),
    startTunnel: vi.fn(),
    stopTunnel: vi.fn(),
    getTunnelStatuses: vi.fn(),
  },
}));

describe("tunnels store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("should initialize with empty state and default status", () => {
    const store = useTunnelsStore();
    expect(store.tunnels).toEqual([]);
    expect(store.statuses).toEqual({});
    expect(store.activeTunnelsCount).toBe(0);

    const defaultStatus = store.getTunnelStatus("t-1");
    expect(defaultStatus.status).toBe("stopped");
    expect(defaultStatus.bytes_sent).toBe(0);
    expect(defaultStatus.bytes_received).toBe(0);
  });

  it("should calculate activeTunnelsCount correctly", () => {
    const store = useTunnelsStore();
    store.statuses = {
      "t-1": {
        tunnel_id: "t-1",
        status: "active",
        bytes_sent: 100,
        bytes_received: 200,
        active_connections: 1,
      },
      "t-2": {
        tunnel_id: "t-2",
        status: "stopped",
        bytes_sent: 0,
        bytes_received: 0,
        active_connections: 0,
      },
      "t-3": {
        tunnel_id: "t-3",
        status: "active",
        bytes_sent: 500,
        bytes_received: 600,
        active_connections: 2,
      },
    };

    expect(store.activeTunnelsCount).toBe(2);
    expect(store.getTunnelStatus("t-1").active_connections).toBe(1);
  });

  it("should fetch tunnels and statuses via service", async () => {
    const store = useTunnelsStore();
    const mockTunnels = [
      {
        id: "t-1",
        host_id: "h-1",
        name: "Postgres",
        tunnel_type: "local" as const,
        local_host: "127.0.0.1",
        local_port: 5433,
        remote_host: "127.0.0.1",
        remote_port: 5432,
        auto_start: false,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
    ];

    vi.mocked(tunnelsService.listTunnels).mockResolvedValueOnce(mockTunnels);
    vi.mocked(tunnelsService.getTunnelStatuses).mockResolvedValueOnce({
      "t-1": {
        tunnel_id: "t-1",
        status: "active",
        bytes_sent: 10,
        bytes_received: 20,
        active_connections: 1,
      },
    });

    await store.fetchTunnels();

    expect(store.tunnels).toEqual(mockTunnels);
    expect(store.statuses["t-1"].status).toBe("active");
  });

  it("should toggle tunnel state based on current status", async () => {
    const store = useTunnelsStore();
    store.statuses["t-1"] = {
      tunnel_id: "t-1",
      status: "stopped",
      bytes_sent: 0,
      bytes_received: 0,
      active_connections: 0,
    };

    vi.mocked(tunnelsService.startTunnel).mockResolvedValueOnce();
    vi.mocked(tunnelsService.getTunnelStatuses).mockResolvedValueOnce({
      "t-1": {
        tunnel_id: "t-1",
        status: "active",
        bytes_sent: 0,
        bytes_received: 0,
        active_connections: 0,
      },
    });

    await store.toggleTunnel("t-1");
    expect(tunnelsService.startTunnel).toHaveBeenCalledWith("t-1");

    vi.mocked(tunnelsService.stopTunnel).mockResolvedValueOnce();
    vi.mocked(tunnelsService.getTunnelStatuses).mockResolvedValueOnce({
      "t-1": {
        tunnel_id: "t-1",
        status: "stopped",
        bytes_sent: 0,
        bytes_received: 0,
        active_connections: 0,
      },
    });

    await store.toggleTunnel("t-1");
    expect(tunnelsService.stopTunnel).toHaveBeenCalledWith("t-1");
  });
});
