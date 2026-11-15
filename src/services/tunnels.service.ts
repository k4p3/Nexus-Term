import { invoke } from "@tauri-apps/api/core";
import type {
  TunnelConfig,
  TunnelConfigPayload,
  TunnelRuntimeStatus,
} from "../types/tunnels";

export const tunnelsService = {
  async listTunnels(hostId?: string): Promise<TunnelConfig[]> {
    return await invoke<TunnelConfig[]>("list_tunnels", {
      hostId: hostId ?? null,
    });
  },

  async saveTunnel(payload: TunnelConfigPayload): Promise<TunnelConfig> {
    return await invoke<TunnelConfig>("save_tunnel", { payload });
  },

  async deleteTunnel(id: string): Promise<void> {
    return await invoke<void>("delete_tunnel", { id });
  },

  async startTunnel(id: string): Promise<void> {
    return await invoke<void>("start_tunnel", { id });
  },

  async stopTunnel(id: string): Promise<void> {
    return await invoke<void>("stop_tunnel", { id });
  },

  async getTunnelStatuses(): Promise<Record<string, TunnelRuntimeStatus>> {
    return await invoke<Record<string, TunnelRuntimeStatus>>("get_tunnel_statuses");
  },
};
