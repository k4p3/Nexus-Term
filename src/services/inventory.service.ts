import { invoke } from "@tauri-apps/api/core";
import type {
  Folder,
  IdentitySummary,
  InventoryData,
  SaveHostPayload,
  SaveIdentityPayload,
} from "../types/inventory";

export const inventoryService = {
  async getInventory(): Promise<InventoryData> {
    return await invoke<InventoryData>("get_inventory");
  },

  async saveFolder(folder: Folder): Promise<string> {
    return await invoke<string>("save_folder", { folder });
  },

  async deleteFolder(id: string): Promise<void> {
    await invoke("delete_folder", { id });
  },

  async saveIdentity(payload: SaveIdentityPayload): Promise<string> {
    return await invoke<string>("save_identity", { payload });
  },

  async deleteIdentity(id: string): Promise<void> {
    await invoke("delete_identity", { id });
  },

  async saveHost(payload: SaveHostPayload): Promise<string> {
    return await invoke<string>("save_host", { payload });
  },

  async deleteHost(id: string): Promise<void> {
    await invoke("delete_host", { id });
  },
};
