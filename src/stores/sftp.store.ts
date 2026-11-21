import { defineStore } from "pinia";
import { i18n } from "../locales";
import { ref, computed } from "vue";
import type { SftpEntry, TransferProgress } from "../types/sftp";
import { sftpService } from "../services/sftp.service";
import { useSettingsStore } from "./settings.store";

export const useSftpStore = defineStore("sftp", () => {
  const settingsStore = useSettingsStore();

  const isOpen = ref(false);
  const isTransferQueueOpen = ref(false);
  const currentSessionId = ref<string | null>(null);
  const currentHostId = ref<string | null>(null);
  const currentPath = ref<string>("/");
  const entries = ref<SftpEntry[]>([]);
  const selectedPaths = ref<string[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const transfers = ref<TransferProgress[]>([]);
  const history = ref<string[]>([]);
  const historyIndex = ref(-1);

  const activeTransfersCount = computed(() => {
    return transfers.value.filter((t) => t.status === "in_progress").length;
  });

  const queuedTransfersCount = computed(() => {
    return transfers.value.filter((t) => t.status === "queued").length;
  });

  const activeTransfersMap = computed<Map<string, TransferProgress>>(() => {
    const map = new Map<string, TransferProgress>();
    for (const t of transfers.value) {
      if (!map.has(t.filename) || t.status === "in_progress" || t.status === "queued") {
        map.set(t.filename, t);
      }
    }
    return map;
  });

  const overallProgress = computed(() => {
    const activeOrQueued = transfers.value.filter(
      (t) => t.status === "in_progress" || t.status === "queued"
    );
    if (activeOrQueued.length === 0) {
      return { active: false, total: 0, completed: 0, percentage: 100 };
    }
    const totalCount = transfers.value.length;
    const completedCount = transfers.value.filter((t) => t.status === "completed").length;
    const totalBytes = transfers.value.reduce((acc, t) => acc + (t.total_bytes || 0), 0);
    const transferredBytes = transfers.value.reduce((acc, t) => acc + (t.bytes_transferred || 0), 0);

    const percentage = totalBytes > 0
      ? Math.round((transferredBytes / totalBytes) * 100)
      : Math.round((completedCount / totalCount) * 100);

    return {
      active: true,
      total: totalCount,
      completed: completedCount,
      percentage: Math.min(100, Math.max(0, percentage)),
    };
  });

  const pathBreadcrumbs = computed(() => {
    const p = currentPath.value;
    if (p === "/" || !p) return [{ label: "/", path: "/" }];

    const parts = p.split("/").filter(Boolean);
    const crumbs = [{ label: "/", path: "/" }];
    let accum = "";
    for (const part of parts) {
      accum += `/${part}`;
      crumbs.push({ label: part, path: accum });
    }
    return crumbs;
  });

  async function openSftp(hostId: string) {
    if (currentSessionId.value && currentHostId.value === hostId) {
      isOpen.value = true;
      return;
    }

    isLoading.value = true;
    error.value = null;
    try {
      const sessionId = await sftpService.connect(hostId);
      currentSessionId.value = sessionId;
      currentHostId.value = hostId;
      isOpen.value = true;

      // Navegar al home o directorio inicial
      const home = await sftpService.resolveHome(sessionId).catch(() => "/");
      await navigateTo(home, false);
    } catch (e: any) {
      error.value = e?.toString() || i18n.global.t('ui.err.sftp.connectFailed');
      isOpen.value = false;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function navigateTo(path: string, recordHistory = true) {
    if (!currentSessionId.value) return;

    isLoading.value = true;
    error.value = null;
    try {
      const [resolvedPath, dirEntries] = await sftpService.listDir(
        currentSessionId.value,
        path
      );
      currentPath.value = resolvedPath;
      entries.value = dirEntries;
      selectedPaths.value = [];

      if (recordHistory) {
        if (historyIndex.value < history.value.length - 1) {
          history.value = history.value.slice(0, historyIndex.value + 1);
        }
        history.value.push(resolvedPath);
        historyIndex.value = history.value.length - 1;
      }
    } catch (e: any) {
      error.value = e?.toString() || i18n.global.t('ui.err.sftp.navigateFailed', { path });
    } finally {
      isLoading.value = false;
    }
  }

  async function navigateUp() {
    if (currentPath.value === "/" || !currentPath.value) return;
    const parts = currentPath.value.split("/").filter(Boolean);
    parts.pop();
    const parent = parts.length === 0 ? "/" : `/${parts.join("/")}`;
    await navigateTo(parent);
  }

  async function refresh() {
    if (!currentPath.value) return;
    await navigateTo(currentPath.value, false);
  }

  async function createFolder(folderName: string) {
    if (!currentSessionId.value) return;
    const trimmed = folderName.trim();
    if (!trimmed) return;

    const newPath = currentPath.value === "/" ? `/${trimmed}` : `${currentPath.value}/${trimmed}`;
    isLoading.value = true;
    try {
      await sftpService.mkdir(currentSessionId.value, newPath);
      await refresh();
    } catch (e: any) {
      error.value = e?.toString() || i18n.global.t('ui.err.sftp.mkdirFailed');
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function renameItem(oldPath: string, newName: string) {
    if (!currentSessionId.value) return;
    const trimmed = newName.trim();
    if (!trimmed) return;

    const parent = oldPath.substring(0, oldPath.lastIndexOf("/")) || "/";
    const newPath = parent === "/" ? `/${trimmed}` : `${parent}/${trimmed}`;

    isLoading.value = true;
    try {
      await sftpService.rename(currentSessionId.value, oldPath, newPath);
      await refresh();
    } catch (e: any) {
      error.value = e?.toString() || i18n.global.t('ui.err.sftp.renameFailed');
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteItem(path: string, isDir: boolean) {
    if (!currentSessionId.value) return;

    isLoading.value = true;
    try {
      await sftpService.remove(currentSessionId.value, path, isDir);
      await refresh();
    } catch (e: any) {
      error.value = e?.toString() || i18n.global.t('ui.err.sftp.deleteFailed');
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  // --- WORKER QUEUE & CONCURRENCY ---

  function processQueue() {
    if (!currentSessionId.value) return;

    const maxConcurrent = Math.max(1, settingsStore.settings.sftp_max_concurrent_transfers || 2);
    const inProgressCount = transfers.value.filter((t) => t.status === "in_progress").length;
    const availableSlots = maxConcurrent - inProgressCount;

    if (availableSlots <= 0) return;

    const queuedTasks = transfers.value
      .filter((t) => t.status === "queued")
      .slice(0, availableSlots);

    for (const task of queuedTasks) {
      task.status = "in_progress";
      task.started_at = Date.now();
      executeTransfer(task);
    }
  }

  async function executeTransfer(task: TransferProgress) {
    if (!currentSessionId.value) return;

    try {
      if (task.direction === "upload" && task.local_path && task.remote_path) {
        await sftpService.upload(
          currentSessionId.value,
          task.local_path,
          task.remote_path,
          (progress) => {
            updateTransferProgress(progress, task.local_path, task.remote_path);
          }
        );
        task.status = "completed";
        task.percentage = 100;
        await refresh();
      } else if (task.direction === "download" && task.local_path && task.remote_path) {
        await sftpService.download(
          currentSessionId.value,
          task.remote_path,
          task.local_path,
          (progress) => {
            updateTransferProgress(progress, task.local_path, task.remote_path);
          }
        );
        task.status = "completed";
        task.percentage = 100;
      }
    } catch (e: any) {
      task.status = "error";
      task.error_message = e?.toString() || i18n.global.t('ui.err.sftp.transferFailed');
    } finally {
      processQueue();
    }
  }

  function updateTransferProgress(progress: TransferProgress, localPath?: string, remotePath?: string) {
    const idx = transfers.value.findIndex((t) => t.transfer_id === progress.transfer_id);
    if (idx >= 0) {
      const prev = transfers.value[idx];
      const now = Date.now();
      const elapsed = (now - (prev.started_at || now)) / 1000;
      const speed = elapsed > 0 ? Math.round(progress.bytes_transferred / elapsed) : 0;

      transfers.value[idx] = {
        ...prev,
        ...progress,
        local_path: prev.local_path || localPath,
        remote_path: prev.remote_path || remotePath,
        speed_bytes_sec: speed,
      };
    } else {
      transfers.value.unshift({
        ...progress,
        local_path: localPath,
        remote_path: remotePath,
        started_at: Date.now(),
      });
    }
  }

  async function uploadFiles(localPaths: string[]) {
    if (!currentSessionId.value || localPaths.length === 0) return;

    isTransferQueueOpen.value = true;
    for (const localPath of localPaths) {
      const filename = localPath.replace(/\\/g, "/").split("/").pop() || localPath;
      const remotePath =
        currentPath.value === "/"
          ? `/${filename}`
          : `${currentPath.value}/${filename}`;

      const transferId = `up-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      transfers.value.unshift({
        transfer_id: transferId,
        direction: "upload",
        filename,
        bytes_transferred: 0,
        total_bytes: 0,
        percentage: 0,
        status: "queued",
        local_path: localPath,
        remote_path: remotePath,
      });
    }

    processQueue();
  }

  async function uploadFile(localPath: string, remoteFilename: string) {
    return uploadFiles([localPath]);
  }

  async function downloadFiles(entriesToDownload: SftpEntry[], customTargetDir?: string) {
    if (!currentSessionId.value || entriesToDownload.length === 0) return;

    let targetDir = customTargetDir;
    if (!targetDir) {
      try {
        targetDir = await sftpService.getDownloadDirectory();
      } catch {
        targetDir = "/tmp";
      }
    }

    isTransferQueueOpen.value = true;
    for (const entry of entriesToDownload) {
      if (entry.is_dir) continue;

      const localPath = `${targetDir}/${entry.name}`;
      const transferId = `down-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      transfers.value.unshift({
        transfer_id: transferId,
        direction: "download",
        filename: entry.name,
        bytes_transferred: 0,
        total_bytes: entry.size || 0,
        percentage: 0,
        status: "queued",
        local_path: localPath,
        remote_path: entry.path,
      });
    }

    processQueue();
  }

  async function downloadFile(remotePath: string, localPath: string) {
    if (!currentSessionId.value) return;

    const filename = remotePath.split("/").pop() || remotePath;
    const transferId = `down-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    transfers.value.unshift({
      transfer_id: transferId,
      direction: "download",
      filename,
      bytes_transferred: 0,
      total_bytes: 0,
      percentage: 0,
      status: "queued",
      local_path: localPath,
      remote_path: remotePath,
    });

    isTransferQueueOpen.value = true;
    processQueue();
  }

  async function downloadSelected(customTargetDir?: string) {
    const selectedEntries = entries.value.filter(
      (e) => selectedPaths.value.includes(e.path) && !e.is_dir
    );
    if (selectedEntries.length > 0) {
      await downloadFiles(selectedEntries, customTargetDir);
      clearSelection();
    }
  }

  function retryTransfer(transferId: string) {
    const item = transfers.value.find((t) => t.transfer_id === transferId);
    if (item && item.status === "error") {
      item.status = "queued";
      item.bytes_transferred = 0;
      item.percentage = 0;
      item.error_message = null;
      processQueue();
    }
  }

  function clearCompleted() {
    transfers.value = transfers.value.filter((t) => t.status !== "completed");
  }

  function toggleSelect(path: string) {
    if (selectedPaths.value.includes(path)) {
      selectedPaths.value = selectedPaths.value.filter((p) => p !== path);
    } else {
      selectedPaths.value.push(path);
    }
  }

  function selectAll() {
    selectedPaths.value = entries.value.map((e) => e.path);
  }

  function clearSelection() {
    selectedPaths.value = [];
  }

  async function closeSftp() {
    if (currentSessionId.value) {
      await sftpService.disconnect(currentSessionId.value).catch(() => {});
    }
    currentSessionId.value = null;
    currentHostId.value = null;
    currentPath.value = "/";
    entries.value = [];
    selectedPaths.value = [];
    isOpen.value = false;
  }

  return {
    isOpen,
    isTransferQueueOpen,
    currentSessionId,
    currentHostId,
    currentPath,
    entries,
    selectedPaths,
    isLoading,
    error,
    transfers,
    activeTransfersCount,
    queuedTransfersCount,
    activeTransfersMap,
    overallProgress,
    pathBreadcrumbs,
    openSftp,
    navigateTo,
    navigateUp,
    refresh,
    createFolder,
    renameItem,
    deleteItem,
    downloadFile,
    downloadFiles,
    downloadSelected,
    uploadFile,
    uploadFiles,
    retryTransfer,
    clearCompleted,
    processQueue,
    toggleSelect,
    selectAll,
    clearSelection,
    closeSftp,
  };
});
