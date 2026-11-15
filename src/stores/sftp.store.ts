import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { SftpEntry, TransferProgress } from "../types/sftp";
import { sftpService } from "../services/sftp.service";

export const useSftpStore = defineStore("sftp", () => {
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
      error.value = e?.toString() || "Error al conectar SFTP";
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
      error.value = e?.toString() || `Error al navegar a ${path}`;
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
      error.value = e?.toString() || "Error al crear la carpeta";
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
      error.value = e?.toString() || "Error al renombrar";
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
      error.value = e?.toString() || "Error al eliminar";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function downloadFile(remotePath: string, localPath: string) {
    if (!currentSessionId.value) return;

    isTransferQueueOpen.value = true;
    try {
      await sftpService.download(
        currentSessionId.value,
        remotePath,
        localPath,
        (progress) => {
          updateTransferProgress(progress);
        }
      );
    } catch (e: any) {
      error.value = e?.toString() || "Error en la descarga";
    }
  }

  async function uploadFile(localPath: string, remoteFilename: string) {
    if (!currentSessionId.value) return;

    const remotePath =
      currentPath.value === "/"
        ? `/${remoteFilename}`
        : `${currentPath.value}/${remoteFilename}`;

    isTransferQueueOpen.value = true;
    try {
      await sftpService.upload(
        currentSessionId.value,
        localPath,
        remotePath,
        (progress) => {
          updateTransferProgress(progress);
        }
      );
      await refresh();
    } catch (e: any) {
      error.value = e?.toString() || "Error en la subida";
    }
  }

  function updateTransferProgress(progress: TransferProgress) {
    const idx = transfers.value.findIndex((t) => t.transfer_id === progress.transfer_id);
    if (idx >= 0) {
      transfers.value[idx] = progress;
    } else {
      transfers.value.unshift(progress);
    }
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
    pathBreadcrumbs,
    openSftp,
    navigateTo,
    navigateUp,
    refresh,
    createFolder,
    renameItem,
    deleteItem,
    downloadFile,
    uploadFile,
    toggleSelect,
    selectAll,
    clearSelection,
    closeSftp,
  };
});
