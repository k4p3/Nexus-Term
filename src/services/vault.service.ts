import { invoke } from "@tauri-apps/api/core";
import type { VaultStatus } from "../types/vault";

export const vaultService = {
  async getStatus(): Promise<VaultStatus> {
    return await invoke<VaultStatus>("vault_status");
  },

  async init(masterPassword: string): Promise<void> {
    await invoke("vault_init", { masterPassword });
  },

  async unlock(masterPassword: string): Promise<void> {
    await invoke("vault_unlock", { masterPassword });
  },

  async lock(): Promise<void> {
    await invoke("vault_lock");
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await invoke("vault_change_password", { currentPassword, newPassword });
  },
};
