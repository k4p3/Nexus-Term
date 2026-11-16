import { invoke } from "@tauri-apps/api/core";

export const sessionLayoutService = {
  async save(layoutJson: string): Promise<void> {
    await invoke("session_layout_save", { layoutJson });
  },
  async get(): Promise<string | null> {
    return await invoke<string | null>("session_layout_get");
  },
  async clear(): Promise<void> {
    await invoke("session_layout_clear");
  },
};
