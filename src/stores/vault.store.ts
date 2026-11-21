import { defineStore } from "pinia";
import { i18n } from "../locales";
import { usePasteHistoryStore } from "./paste-history.store";
import { useHistoryStore } from "./history.store";
import { useReplayStore } from "./replay.store";
import { ref } from "vue";
import { vaultService } from "../services/vault.service";
import { inventoryService } from "../services/inventory.service";
import type {
  Folder,
  HostSummary,
  IdentitySummary,
  SaveHostPayload,
  SaveIdentityPayload,
} from "../types/inventory";

export const useVaultStore = defineStore("vault", () => {
  const isInitialized = ref(false);
  const isUnlocked = ref(false);
  const isLoading = ref(true);
  const error = ref<string | null>(null);

  // Inventory state
  const folders = ref<Folder[]>([]);
  const identities = ref<IdentitySummary[]>([]);
  const hosts = ref<HostSummary[]>([]);

  async function checkStatus() {
    isLoading.value = true;
    error.value = null;
    try {
      const status = await vaultService.getStatus();
      isInitialized.value = status.is_initialized;
      isUnlocked.value = status.is_unlocked;
      if (isUnlocked.value) {
        await fetchInventory();
      }
    } catch (err: any) {
      error.value = typeof err === "string" ? err : err?.message || i18n.global.t('ui.err.vault.statusFailed');
    } finally {
      isLoading.value = false;
    }
  }

  async function init(masterPassword: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await vaultService.init(masterPassword);
      isInitialized.value = true;
      isUnlocked.value = true;
      await fetchInventory();
    } catch (err: any) {
      error.value = typeof err === "string" ? err : err?.message || i18n.global.t('ui.err.vault.initFailed');
      throw error.value;
    } finally {
      isLoading.value = false;
    }
  }

  async function unlock(masterPassword: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await vaultService.unlock(masterPassword);
      isUnlocked.value = true;
      await fetchInventory();
    } catch (err: any) {
      error.value = typeof err === "string" ? err : err?.message || i18n.global.t('ui.err.vault.wrongPassword');
      throw error.value;
    } finally {
      isLoading.value = false;
    }
  }

  async function lock() {
    isLoading.value = true;
    try {
      await vaultService.lock();
      isUnlocked.value = false;
      // El historial de pegado puede contener secretos: se descarta al bloquear.
      usePasteHistoryStore().clear();
      useHistoryStore().reset();
      useReplayStore().clearAll();
      folders.value = [];
      identities.value = [];
      hosts.value = [];
    } catch (err: any) {
      error.value = typeof err === "string" ? err : err?.message || i18n.global.t('ui.err.vault.lockFailed');
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchInventory() {
    try {
      const inv = await inventoryService.getInventory();
      folders.value = inv.folders;
      identities.value = inv.identities;
      hosts.value = inv.hosts;
    } catch (err: any) {
      console.error("Error fetching inventory:", err);
    }
  }

  async function saveFolder(folder: Folder): Promise<string> {
    const id = await inventoryService.saveFolder(folder);
    await fetchInventory();
    return id;
  }

  async function deleteFolder(id: string) {
    await inventoryService.deleteFolder(id);
    await fetchInventory();
  }

  async function saveIdentity(payload: SaveIdentityPayload): Promise<string> {
    const id = await inventoryService.saveIdentity(payload);
    await fetchInventory();
    return id;
  }

  async function deleteIdentity(id: string) {
    await inventoryService.deleteIdentity(id);
    await fetchInventory();
  }

  async function saveHost(payload: SaveHostPayload): Promise<string> {
    const id = await inventoryService.saveHost(payload);
    await fetchInventory();
    return id;
  }

  async function deleteHost(id: string) {
    await inventoryService.deleteHost(id);
    await fetchInventory();
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      await vaultService.changePassword(currentPassword, newPassword);
    } catch (err: any) {
      error.value = typeof err === "string" ? err : err?.message || i18n.global.t('ui.err.vault.rotateFailed');
      throw error.value;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    isInitialized,
    isUnlocked,
    isLoading,
    error,
    folders,
    identities,
    hosts,
    checkStatus,
    init,
    unlock,
    lock,
    changePassword,
    fetchInventory,
    saveFolder,
    deleteFolder,
    saveIdentity,
    deleteIdentity,
    saveHost,
    deleteHost,
  };
});
