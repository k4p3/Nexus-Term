<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useSftpStore } from "../../stores/sftp.store";
import { useVaultStore } from "../../stores/vault.store";
import { sftpService } from "../../services/sftp.service";
import type { SftpEntry } from "../../types/sftp";
import {
  Folder,
  File,
  FileCode,
  FileText,
  CornerUpRight,
  ArrowUp,
  RefreshCw,
  FolderPlus,
  Upload,
  Download,
  Edit2,
  Trash2,
  X,
  FolderSync,
  AlertCircle,
  HardDrive,
  ChevronRight,
  Search,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-vue-next";

const sftpStore = useSftpStore();
const vaultStore = useVaultStore();

const searchQuery = ref("");
const isNewFolderModalOpen = ref(false);
const newFolderName = ref("");
const isRenameModalOpen = ref(false);
const itemToRename = ref<SftpEntry | null>(null);
const renameValue = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
const isDraggingOver = ref(false);

let unlistenTauriDragDrop: (() => void) | null = null;

onMounted(async () => {
  try {
    const webview = getCurrentWebview();
    unlistenTauriDragDrop = await webview.onDragDropEvent((event) => {
      if (event.payload.type === "drop" && sftpStore.isOpen && sftpStore.currentSessionId) {
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          sftpStore.uploadFiles(paths);
        }
        isDraggingOver.value = false;
      } else if (event.payload.type === "over") {
        isDraggingOver.value = true;
      } else if (event.payload.type === "leave") {
        isDraggingOver.value = false;
      }
    });
  } catch {}
});

onUnmounted(() => {
  if (unlistenTauriDragDrop) {
    unlistenTauriDragDrop();
  }
});

const currentHost = computed(() => {
  return vaultStore.hosts.find((h) => h.id === sftpStore.currentHostId);
});

const filteredEntries = computed(() => {
  if (!searchQuery.value.trim()) return sftpStore.entries;
  const q = searchQuery.value.toLowerCase();
  return sftpStore.entries.filter((e) => e.name.toLowerCase().includes(q));
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(isoDate?: string | null): string {
  if (!isoDate) return "-";
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoDate;
  }
}

function handleEntryDblClick(entry: SftpEntry) {
  if (entry.is_dir) {
    sftpStore.navigateTo(entry.path);
  } else {
    handleDownload(entry);
  }
}

function handleDownload(entry: SftpEntry) {
  sftpStore.downloadFiles([entry]);
}

async function triggerFileUpload() {
  try {
    const paths = await sftpService.pickUploadFiles("Seleccionar archivos para subir");
    if (paths && paths.length > 0) {
      await sftpStore.uploadFiles(paths);
      return;
    }
  } catch {
    // Si falla el diálogo nativo, fallback al input web
  }
  fileInput.value?.click();
}

function onFileSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const paths: string[] = [];
    for (let i = 0; i < target.files.length; i++) {
      const file = target.files[i];
      const localPath = (file as any).path;
      if (localPath) paths.push(localPath);
    }
    if (paths.length > 0) {
      sftpStore.uploadFiles(paths);
    }
    target.value = "";
  }
}

function handleWebDrop(e: DragEvent) {
  isDraggingOver.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const paths: string[] = [];
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i];
      const localPath = (file as any).path;
      if (localPath) paths.push(localPath);
    }
    if (paths.length > 0) {
      sftpStore.uploadFiles(paths);
    }
  }
}

function openCreateFolder() {
  newFolderName.value = "";
  isNewFolderModalOpen.value = true;
}

async function confirmCreateFolder() {
  if (!newFolderName.value.trim()) return;
  await sftpStore.createFolder(newFolderName.value.trim());
  isNewFolderModalOpen.value = false;
}

function openRename(entry: SftpEntry) {
  itemToRename.value = entry;
  renameValue.value = entry.name;
  isRenameModalOpen.value = true;
}

async function confirmRename() {
  if (!itemToRename.value || !renameValue.value.trim()) return;
  await sftpStore.renameItem(itemToRename.value.path, renameValue.value.trim());
  isRenameModalOpen.value = false;
}

async function handleDelete(entry: SftpEntry) {
  const typeStr = entry.is_dir ? "esta carpeta" : "este archivo";
  if (confirm(`¿Estás seguro de eliminar ${typeStr} "${entry.name}" del servidor?`)) {
    await sftpStore.deleteItem(entry.path, entry.is_dir);
  }
}

async function handleDeleteSelected() {
  const count = sftpStore.selectedPaths.length;
  if (count === 0) return;
  if (confirm(`¿Estás seguro de eliminar los ${count} elementos seleccionados del servidor?`)) {
    for (const path of [...sftpStore.selectedPaths]) {
      const entry = sftpStore.entries.find((e) => e.path === path);
      if (entry) {
        await sftpStore.deleteItem(entry.path, entry.is_dir);
      }
    }
    sftpStore.clearSelection();
  }
}
</script>

<template>
  <aside
    v-if="sftpStore.isOpen"
    class="w-96 bg-surface border-l border-line flex flex-col h-full select-none shrink-0 z-30 relative"
  >
    <!-- Hidden input for file upload (with multiple enabled) -->
    <input
      ref="fileInput"
      type="file"
      multiple
      class="hidden"
      @change="onFileSelected"
    />

    <!-- Header -->
    <div class="p-3 border-b border-line space-y-2 bg-app/50">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2 truncate">
          <div class="p-1 rounded-lg bg-accent/10 text-accent border border-accent/20">
            <HardDrive class="w-3.5 h-3.5" />
          </div>
          <div class="truncate">
            <div class="text-xs font-semibold text-fg truncate">
              SFTP: {{ currentHost?.label || "Servidor Remoto" }}
            </div>
            <div class="text-[10px] text-fg-muted font-mono truncate">
              {{ currentHost?.hostname }}:{{ currentHost?.port }}
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-1">
          <button
            @click="sftpStore.isTransferQueueOpen = !sftpStore.isTransferQueueOpen"
            class="p-1.5 text-fg-muted hover:text-accent rounded-lg hover:bg-active transition relative cursor-pointer"
            title="Cola de Transferencias"
          >
            <FolderSync class="w-3.5 h-3.5" />
            <span
              v-if="sftpStore.activeTransfersCount > 0"
              class="w-1.5 h-1.5 rounded-full bg-accent-hover absolute top-1 right-1 animate-pulse"
            ></span>
          </button>
          <button
            @click="sftpStore.closeSftp()"
            class="p-1.5 text-fg-muted hover:text-fg rounded-lg hover:bg-active transition cursor-pointer"
            title="Cerrar Explorador SFTP"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Navigation & Actions Toolbar -->
      <div class="flex items-center space-x-1">
        <button
          @click="sftpStore.navigateUp()"
          :disabled="sftpStore.currentPath === '/' || sftpStore.isLoading"
          class="p-1.5 text-fg-muted hover:text-fg hover:bg-active disabled:opacity-40 rounded-lg border border-line transition cursor-pointer"
          title="Subir de nivel (..)"
        >
          <ArrowUp class="w-3.5 h-3.5" />
        </button>

        <button
          @click="sftpStore.refresh()"
          :disabled="sftpStore.isLoading"
          class="p-1.5 text-fg-muted hover:text-fg hover:bg-active rounded-lg border border-line transition cursor-pointer"
          title="Refrescar directorio"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': sftpStore.isLoading }" />
        </button>

        <button
          @click="openCreateFolder()"
          class="p-1.5 text-fg-muted hover:text-accent hover:bg-active rounded-lg border border-line transition cursor-pointer"
          title="Nueva Carpeta"
        >
          <FolderPlus class="w-3.5 h-3.5" />
        </button>

        <button
          @click="triggerFileUpload()"
          class="p-1.5 text-fg-muted hover:text-accent hover:bg-active rounded-lg border border-line transition cursor-pointer"
          title="Subir Archivos al servidor (selección múltiple)"
        >
          <Upload class="w-3.5 h-3.5" />
        </button>

        <!-- Search input -->
        <div class="flex-1 relative">
          <Search class="w-3 h-3 text-fg-muted absolute left-2 top-2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Filtrar archivos..."
            class="w-full pl-6 pr-2 py-1 bg-app border border-line rounded-lg text-[11px] text-fg placeholder-fg-muted focus:outline-hidden focus:border-accent transition"
          />
        </div>
      </div>

      <!-- Breadcrumbs Bar -->
      <div class="flex items-center space-x-1 text-[11px] font-mono text-fg-muted overflow-x-auto py-0.5 no-scrollbar">
        <template v-for="(crumb, idx) in sftpStore.pathBreadcrumbs" :key="crumb.path">
          <ChevronRight v-if="idx > 0" class="w-3 h-3 text-fg-muted shrink-0" />
          <button
            @click="sftpStore.navigateTo(crumb.path)"
            class="hover:text-accent hover:underline px-1 py-0.5 rounded shrink-0 transition cursor-pointer"
            :class="{ 'text-accent font-semibold': idx === sftpStore.pathBreadcrumbs.length - 1 }"
          >
            {{ crumb.label }}
          </button>
        </template>
      </div>

      <!-- Overall Transfer Progress Ticker -->
      <div
        v-if="sftpStore.overallProgress.active"
        @click="sftpStore.isTransferQueueOpen = true"
        class="px-2.5 py-1.5 bg-accent/10 border border-accent/20 rounded-lg text-[11px] text-accent flex items-center justify-between cursor-pointer hover:bg-accent/15 transition"
      >
        <div class="flex items-center space-x-1.5 truncate">
          <RefreshCw class="w-3 h-3 text-accent animate-spin shrink-0" />
          <span class="truncate">
            {{ sftpStore.overallProgress.completed }}/{{ sftpStore.overallProgress.total }} archivos transferidos ({{ sftpStore.overallProgress.percentage }}%)
          </span>
        </div>
        <div class="text-[10px] font-mono font-semibold shrink-0 ml-2">
          Ver cola &rarr;
        </div>
      </div>
    </div>

    <!-- Error Banner -->
    <div
      v-if="sftpStore.error"
      class="p-2.5 bg-danger/10 border-b border-danger/20 text-danger text-xs flex items-center space-x-2 shrink-0"
    >
      <AlertCircle class="w-4 h-4 shrink-0" />
      <span class="truncate">{{ sftpStore.error }}</span>
    </div>

    <!-- File List Body with Drag & Drop Zone -->
    <div
      class="flex-1 overflow-y-auto p-1.5 space-y-0.5 relative"
      @dragover.prevent="isDraggingOver = true"
      @dragenter.prevent="isDraggingOver = true"
      @dragleave.prevent="isDraggingOver = false"
      @drop.prevent="handleWebDrop"
    >
      <!-- Drag & Drop Visual Overlay -->
      <div
        v-if="isDraggingOver"
        class="absolute inset-0 z-40 bg-accent/80 border-2 border-dashed border-accent rounded-xl flex flex-col items-center justify-center space-y-2 backdrop-blur-xs p-4 text-center pointer-events-none"
      >
        <Upload class="w-8 h-8 text-accent animate-bounce" />
        <p class="text-xs font-semibold text-accent">
          Soltar archivos aquí para subir a:
        </p>
        <p class="text-[11px] font-mono text-accent truncate max-w-full px-2">
          {{ sftpStore.currentPath }}
        </p>
      </div>

      <div
        v-if="sftpStore.isLoading && sftpStore.entries.length === 0"
        class="py-12 text-center text-xs text-fg-muted space-y-2"
      >
        <RefreshCw class="w-5 h-5 mx-auto animate-spin text-accent" />
        <p>Cargando archivos remotos...</p>
      </div>

      <!-- No active SFTP session picker -->
      <div
        v-else-if="!sftpStore.currentSessionId"
        class="py-8 px-4 text-center text-xs space-y-4"
      >
        <div class="w-12 h-12 rounded-2xl bg-warning/10 border border-warning/20 text-warning flex items-center justify-center mx-auto shadow-inner">
          <FolderSync class="w-6 h-6" />
        </div>
        <div>
          <p class="font-semibold text-fg text-sm">Explorador SFTP</p>
          <p class="text-[11px] text-fg-muted mt-1 leading-relaxed">
            Selecciona un servidor guardado para explorar sus archivos remotos y transferir archivos:
          </p>
        </div>
        <div class="space-y-1.5 max-h-72 overflow-y-auto text-left pt-1">
          <div
            v-for="host in vaultStore.hosts"
            :key="host.id"
            @click="sftpStore.openSftp(host.id)"
            class="flex items-center justify-between p-2.5 rounded-xl bg-app hover:bg-active border border-line cursor-pointer transition group"
          >
            <div class="truncate">
              <div class="font-medium text-fg group-hover:text-warning truncate transition">
                {{ host.label }}
              </div>
              <div class="text-[10px] text-fg-muted font-mono truncate">
                {{ host.hostname }}:{{ host.port }}
              </div>
            </div>
            <div class="p-1 rounded bg-warning/10 text-warning opacity-80 group-hover:opacity-100 transition shrink-0 ml-2">
              <FolderSync class="w-3.5 h-3.5" />
            </div>
          </div>
          <div v-if="vaultStore.hosts.length === 0" class="text-center text-fg-muted text-[11px] py-4">
            No tienes servidores guardados en la bóveda. Agrega uno en la barra lateral izquierda.
          </div>
        </div>
      </div>

      <div
        v-else-if="filteredEntries.length === 0"
        class="py-12 text-center text-xs text-fg-muted"
      >
        {{ searchQuery ? "No se encontraron coincidencias" : "Directorio vacío" }}
      </div>

      <!-- File Rows with Checkboxes and Inline Progress -->
      <div
        v-for="entry in filteredEntries"
        :key="entry.path"
        @dblclick="handleEntryDblClick(entry)"
        class="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-active border border-transparent hover:border-line group cursor-pointer text-xs transition"
        :class="{ 'bg-active/60 border-line': sftpStore.selectedPaths.includes(entry.path) }"
      >
        <div class="flex items-center space-x-2 truncate min-w-0">
          <!-- Selection Checkbox -->
          <input
            type="checkbox"
            :checked="sftpStore.selectedPaths.includes(entry.path)"
            @click.stop="sftpStore.toggleSelect(entry.path)"
            class="w-3.5 h-3.5 rounded border-line text-accent focus:ring-0 focus:ring-offset-0 bg-app cursor-pointer shrink-0"
          />

          <Folder v-if="entry.is_dir" class="w-4 h-4 text-accent fill-accent/20 shrink-0" />
          <CornerUpRight v-else-if="entry.is_symlink" class="w-4 h-4 text-warning shrink-0" />
          <FileCode
            v-else-if="entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.rs') || entry.name.endsWith('.json')"
            class="w-4 h-4 text-accent shrink-0"
          />
          <FileText v-else-if="entry.name.endsWith('.log') || entry.name.endsWith('.txt') || entry.name.endsWith('.md')" class="w-4 h-4 text-fg-muted shrink-0" />
          <File v-else class="w-4 h-4 text-fg-muted shrink-0" />

          <div class="truncate">
            <div class="font-medium text-fg truncate leading-tight flex items-center">
              <span class="truncate">{{ entry.name }}</span>

              <!-- Inline Transfer Progress Badge -->
              <span
                v-if="sftpStore.activeTransfersMap.has(entry.name)"
                class="ml-1.5 inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[9px] font-mono shrink-0"
                :class="{
                  'bg-accent/20 text-accent border border-accent/30': sftpStore.activeTransfersMap.get(entry.name)?.status === 'in_progress',
                  'bg-warning/20 text-warning border border-warning/30': sftpStore.activeTransfersMap.get(entry.name)?.status === 'queued',
                  'bg-success/20 text-success border border-success/30': sftpStore.activeTransfersMap.get(entry.name)?.status === 'completed',
                  'bg-danger/20 text-danger border border-danger/30': sftpStore.activeTransfersMap.get(entry.name)?.status === 'error',
                }"
              >
                <RefreshCw
                  v-if="sftpStore.activeTransfersMap.get(entry.name)?.status === 'in_progress'"
                  class="w-2.5 h-2.5 animate-spin text-accent"
                />
                <Clock
                  v-else-if="sftpStore.activeTransfersMap.get(entry.name)?.status === 'queued'"
                  class="w-2.5 h-2.5 text-warning"
                />
                <CheckCircle2
                  v-else-if="sftpStore.activeTransfersMap.get(entry.name)?.status === 'completed'"
                  class="w-2.5 h-2.5 text-success"
                />
                <AlertCircle
                  v-else-if="sftpStore.activeTransfersMap.get(entry.name)?.status === 'error'"
                  class="w-2.5 h-2.5 text-danger"
                />
                <span>
                  {{
                    sftpStore.activeTransfersMap.get(entry.name)?.status === 'in_progress'
                      ? `${sftpStore.activeTransfersMap.get(entry.name)?.percentage.toFixed(0)}%`
                      : sftpStore.activeTransfersMap.get(entry.name)?.status === 'queued'
                      ? 'En cola'
                      : sftpStore.activeTransfersMap.get(entry.name)?.status === 'completed'
                      ? 'Listo'
                      : 'Error'
                  }}
                </span>
              </span>
            </div>
            <div class="text-[10px] text-fg-muted font-mono space-x-2">
              <span v-if="!entry.is_dir">{{ formatBytes(entry.size) }}</span>
              <span>{{ entry.permissions_str }}</span>
              <span>{{ formatDate(entry.modified_at) }}</span>
            </div>
          </div>
        </div>

        <!-- Quick Row Actions -->
        <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            v-if="!entry.is_dir"
            @click.stop="handleDownload(entry)"
            class="p-1 text-fg-muted hover:text-accent rounded transition cursor-pointer"
            title="Descargar archivo"
          >
            <Download class="w-3 h-3" />
          </button>
          <button
            @click.stop="openRename(entry)"
            class="p-1 text-fg-muted hover:text-fg rounded transition cursor-pointer"
            title="Renombrar"
          >
            <Edit2 class="w-3 h-3" />
          </button>
          <button
            @click.stop="handleDelete(entry)"
            class="p-1 text-fg-muted hover:text-danger rounded transition cursor-pointer"
            title="Eliminar"
          >
            <Trash2 class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>

    <!-- Batch Selection Floating Toolbar -->
    <div
      v-if="sftpStore.selectedPaths.length > 0"
      class="p-2 border-t border-line bg-app/90 flex items-center justify-between text-xs"
    >
      <div class="flex items-center space-x-1.5 text-fg font-medium">
        <Layers class="w-3.5 h-3.5 text-accent" />
        <span>{{ sftpStore.selectedPaths.length }} seleccionados</span>
      </div>

      <div class="flex items-center space-x-1">
        <button
          @click="sftpStore.downloadSelected()"
          class="px-2 py-1 rounded-md bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 flex items-center space-x-1 text-[11px] font-medium transition cursor-pointer"
          title="Descargar todos los seleccionados"
        >
          <Download class="w-3 h-3" />
          <span>Descargar</span>
        </button>

        <button
          @click="handleDeleteSelected()"
          class="px-2 py-1 rounded-md bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30 flex items-center space-x-1 text-[11px] font-medium transition cursor-pointer"
          title="Eliminar elementos seleccionados"
        >
          <Trash2 class="w-3 h-3" />
          <span>Eliminar</span>
        </button>

        <button
          @click="sftpStore.clearSelection()"
          class="p-1 text-fg-muted hover:text-fg rounded transition cursor-pointer"
          title="Limpiar selección"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Create Folder Modal Prompt -->
    <div
      v-if="isNewFolderModalOpen"
      @click.self="isNewFolderModalOpen = false"
      class="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
    >
      <div class="bg-surface border border-line rounded-xl p-4 w-80 space-y-3 text-fg">
        <h3 class="text-xs font-semibold">Nueva Carpeta Remota</h3>
        <input
          v-model="newFolderName"
          type="text"
          placeholder="Nombre de la carpeta"
          class="w-full px-2.5 py-1.5 bg-app border border-line rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent"
          @keyup.enter="confirmCreateFolder"
        />
        <div class="flex justify-end space-x-2 text-xs">
          <button
            @click="isNewFolderModalOpen = false"
            class="px-3 py-1.5 rounded-lg border border-line hover:bg-active text-fg cursor-pointer"
          >
            Cancelar
          </button>
          <button
            @click="confirmCreateFolder"
            class="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-on-accent font-medium cursor-pointer"
          >
            Crear
          </button>
        </div>
      </div>
    </div>

    <!-- Rename Item Modal Prompt -->
    <div
      v-if="isRenameModalOpen"
      @click.self="isRenameModalOpen = false"
      class="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
    >
      <div class="bg-surface border border-line rounded-xl p-4 w-80 space-y-3 text-fg">
        <h3 class="text-xs font-semibold">Renombrar Elemento</h3>
        <input
          v-model="renameValue"
          type="text"
          class="w-full px-2.5 py-1.5 bg-app border border-line rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent"
          @keyup.enter="confirmRename"
        />
        <div class="flex justify-end space-x-2 text-xs">
          <button
            @click="isRenameModalOpen = false"
            class="px-3 py-1.5 rounded-lg border border-line hover:bg-active text-fg cursor-pointer"
          >
            Cancelar
          </button>
          <button
            @click="confirmRename"
            class="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-on-accent font-medium cursor-pointer"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
