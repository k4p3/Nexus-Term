<script setup lang="ts">
import { useSftpStore } from "../../stores/sftp.store";
import {
  X,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Trash2,
  FolderSync,
} from "lucide-vue-next";

const sftpStore = useSftpStore();

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function clearCompleted() {
  sftpStore.clearCompleted();
}
</script>

<template>
  <div
    v-if="sftpStore.isTransferQueueOpen"
    class="fixed bottom-4 right-4 z-50 w-96 max-h-96 bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950/60">
      <div class="flex items-center space-x-2">
        <FolderSync class="w-4 h-4 text-cyan-400" />
        <span class="text-xs font-semibold text-white">Cola de Transferencias SFTP</span>
        <span
          v-if="sftpStore.activeTransfersCount > 0"
          class="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300"
        >
          {{ sftpStore.activeTransfersCount }}
        </span>
      </div>

      <div class="flex items-center space-x-1">
        <button
          @click="clearCompleted()"
          class="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition cursor-pointer"
          title="Limpiar completadas"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
        <button
          @click="sftpStore.isTransferQueueOpen = false"
          class="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition cursor-pointer"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Transfers List -->
    <div class="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
      <div
        v-if="sftpStore.transfers.length === 0"
        class="py-8 text-center text-neutral-500 text-[11px]"
      >
        No hay transferencias activas ni recientes
      </div>

      <div
        v-for="transfer in sftpStore.transfers"
        :key="transfer.transfer_id"
        class="p-2.5 rounded-xl bg-neutral-950/40 border border-neutral-800/80 space-y-1.5"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2 truncate">
            <Upload
              v-if="transfer.direction === 'upload'"
              class="w-3.5 h-3.5 text-indigo-400 shrink-0"
            />
            <Download v-else class="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span class="font-medium text-neutral-200 truncate">{{ transfer.filename }}</span>
          </div>

          <div class="shrink-0 flex items-center space-x-1.5">
            <span
              v-if="transfer.status === 'queued'"
              class="text-amber-400/90 flex items-center space-x-1 text-[10px]"
            >
              <Clock class="w-3 h-3" />
              <span>En cola</span>
            </span>
            <span
              v-else-if="transfer.status === 'completed'"
              class="text-emerald-400 flex items-center space-x-1 text-[10px]"
            >
              <CheckCircle2 class="w-3 h-3" />
              <span>Listo</span>
            </span>
            <div
              v-else-if="transfer.status === 'error'"
              class="flex items-center space-x-1.5"
            >
              <span class="text-red-400 flex items-center space-x-1 text-[10px]">
                <AlertCircle class="w-3 h-3" />
                <span>Error</span>
              </span>
              <button
                v-if="transfer.local_path && transfer.remote_path"
                @click="sftpStore.retryTransfer(transfer.transfer_id)"
                class="p-0.5 text-neutral-400 hover:text-cyan-400 rounded transition cursor-pointer"
                title="Reintentar transferencia"
              >
                <RotateCcw class="w-3 h-3" />
              </button>
            </div>
            <span v-else class="text-cyan-400 font-mono text-[10px]">
              {{ transfer.percentage.toFixed(0) }}%
            </span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
          <div
            class="h-full transition-all duration-200"
            :class="{
              'bg-amber-500/40': transfer.status === 'queued',
              'bg-cyan-500': transfer.status === 'in_progress',
              'bg-emerald-500': transfer.status === 'completed',
              'bg-red-500': transfer.status === 'error',
            }"
            :style="{ width: transfer.status === 'queued' ? '100%' : `${Math.min(100, Math.max(0, transfer.percentage))}%` }"
          ></div>
        </div>

        <!-- Stats -->
        <div class="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
          <span v-if="transfer.status === 'queued'">
            En espera de ranura libre...
          </span>
          <span v-else>
            {{ formatBytes(transfer.bytes_transferred) }} / {{ formatBytes(transfer.total_bytes) }}
          </span>

          <div class="flex items-center space-x-2">
            <span
              v-if="transfer.status === 'in_progress' && transfer.speed_bytes_sec && transfer.speed_bytes_sec > 0"
              class="text-neutral-400"
            >
              {{ formatBytes(transfer.speed_bytes_sec) }}/s
            </span>
            <span v-if="transfer.error_message" class="text-red-400 truncate max-w-[150px]">
              {{ transfer.error_message }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
