import { invoke, Channel } from "@tauri-apps/api/core";
import type { SftpEntry, TransferProgress } from "../types/sftp";

export const sftpService = {
  async connect(hostId: string): Promise<string> {
    return await invoke<string>("sftp_connect", { hostId });
  },

  async resolveHome(sessionId: string): Promise<string> {
    return await invoke<string>("sftp_resolve_home", { sessionId });
  },

  async listDir(sessionId: string, path?: string): Promise<[string, SftpEntry[]]> {
    return await invoke<[string, SftpEntry[]]>("sftp_list_dir", {
      sessionId,
      path: path ?? null,
    });
  },

  async mkdir(sessionId: string, path: string): Promise<void> {
    return await invoke<void>("sftp_mkdir", { sessionId, path });
  },

  async rename(sessionId: string, oldPath: string, newPath: string): Promise<void> {
    return await invoke<void>("sftp_rename", { sessionId, oldPath, newPath });
  },

  async remove(sessionId: string, path: string, isDir: boolean): Promise<void> {
    return await invoke<void>("sftp_remove", { sessionId, path, isDir });
  },

  async download(
    sessionId: string,
    remotePath: string,
    localPath: string,
    onProgress: (progress: TransferProgress) => void
  ): Promise<void> {
    const channel = new Channel<TransferProgress>();
    channel.onmessage = onProgress;
    return await invoke<void>("sftp_download", {
      sessionId,
      remotePath,
      localPath,
      onProgress: channel,
    });
  },

  async upload(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (progress: TransferProgress) => void
  ): Promise<void> {
    const channel = new Channel<TransferProgress>();
    channel.onmessage = onProgress;
    return await invoke<void>("sftp_upload", {
      sessionId,
      localPath,
      remotePath,
      onProgress: channel,
    });
  },

  async disconnect(sessionId: string): Promise<void> {
    return await invoke<void>("sftp_disconnect", { sessionId });
  },
};
