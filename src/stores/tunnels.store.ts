import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  TunnelConfig,
  TunnelConfigPayload,
  TunnelRuntimeStatus,
} from "../types/tunnels";
import { tunnelsService } from "../services/tunnels.service";

export const useTunnelsStore = defineStore("tunnels", () => {
  const tunnels = ref<TunnelConfig[]>([]);
  const statuses = ref<Record<string, TunnelRuntimeStatus>>({});
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const activeTunnelsCount = computed(() => {
    return Object.values(statuses.value).filter((s) => s.status === "active").length;
  });

  function getTunnelStatus(tunnelId: string): TunnelRuntimeStatus {
    return (
      statuses.value[tunnelId] || {
        tunnel_id: tunnelId,
        status: "stopped",
        bytes_sent: 0,
        bytes_received: 0,
        active_connections: 0,
      }
    );
  }

  async function fetchTunnels(hostId?: string) {
    isLoading.value = true;
    error.value = null;
    try {
      tunnels.value = await tunnelsService.listTunnels(hostId);
      await refreshStatuses();
    } catch (e: any) {
      error.value = e?.toString() || "Error al cargar los túneles";
    } finally {
      isLoading.value = false;
    }
  }

  async function saveTunnel(payload: TunnelConfigPayload): Promise<TunnelConfig> {
    isLoading.value = true;
    error.value = null;
    try {
      const saved = await tunnelsService.saveTunnel(payload);
      const idx = tunnels.value.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        tunnels.value[idx] = saved;
      } else {
        tunnels.value.push(saved);
      }
      return saved;
    } catch (e: any) {
      error.value = e?.toString() || "Error al guardar el túnel";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteTunnel(id: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await tunnelsService.deleteTunnel(id);
      tunnels.value = tunnels.value.filter((t) => t.id !== id);
      delete statuses.value[id];
    } catch (e: any) {
      error.value = e?.toString() || "Error al eliminar el túnel";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function startTunnel(id: string) {
    error.value = null;
    try {
      await tunnelsService.startTunnel(id);
      await refreshStatuses();
    } catch (e: any) {
      error.value = e?.toString() || "Error al iniciar el túnel";
      await refreshStatuses();
      throw e;
    }
  }

  async function stopTunnel(id: string) {
    error.value = null;
    try {
      await tunnelsService.stopTunnel(id);
      await refreshStatuses();
    } catch (e: any) {
      error.value = e?.toString() || "Error al detener el túnel";
      throw e;
    }
  }

  async function toggleTunnel(id: string) {
    const current = getTunnelStatus(id);
    if (current.status === "active") {
      await stopTunnel(id);
    } else {
      await startTunnel(id);
    }
  }

  async function refreshStatuses() {
    try {
      const currentStatuses = await tunnelsService.getTunnelStatuses();
      statuses.value = currentStatuses;
    } catch {
      // Ignore polling errors
    }
  }

  function startPolling(intervalMs = 2000) {
    if (pollInterval) return;
    refreshStatuses();
    pollInterval = setInterval(refreshStatuses, intervalMs);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  return {
    tunnels,
    statuses,
    isLoading,
    error,
    activeTunnelsCount,
    getTunnelStatus,
    fetchTunnels,
    saveTunnel,
    deleteTunnel,
    startTunnel,
    stopTunnel,
    toggleTunnel,
    refreshStatuses,
    startPolling,
    stopPolling,
  };
});
