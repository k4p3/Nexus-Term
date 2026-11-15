import { invoke } from "@tauri-apps/api/core";
import type {
  SshConfigPreview,
  ImportSshConfigPayload,
  ImportSummary,
} from "../types/ssh_config";

export const sshConfigService = {
  async detectSshConfig(): Promise<SshConfigPreview> {
    return await invoke<SshConfigPreview>("detect_ssh_config");
  },

  async importSshConfig(payload: ImportSshConfigPayload): Promise<ImportSummary> {
    return await invoke<ImportSummary>("import_ssh_config", { payload });
  },
};
