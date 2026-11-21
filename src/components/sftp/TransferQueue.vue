<script setup lang="ts">
import { useI18n } from "vue-i18n";
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

const { t } = useI18n();
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
    class="fixed bottom-4 right-4 z-50 w-96 max-h-96 bg-surface border border-line/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-fg"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-line bg-app/60">
      <div class="flex items-center space-x-2">
        <FolderSync class="w-4 h-4 text-accent" />
        <span class="text-xs font-semibold text-fg">{{ t('ui.queue.title') }}</span>
        <span
          v-if="sftpStore.activeTransfersCount > 0"
          class="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-accent/20 text-accent"
        >
          {{ sftpStore.activeTransfersCount }}
        </span>
      </div>

      <div class="flex items-center space-x-1">
        <button
          @click="clearCompleted()"
          class="p-1 text-fg-muted hover:text-fg rounded hover:bg-active transition cursor-pointer"
          :title="t('ui.queue.clearDone')"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
        <button
          @click="sftpStore.isTransferQueueOpen = false"
          class="p-1 text-fg-muted hover:text-fg rounded hover:bg-active transition cursor-pointer"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Transfers List -->
    <div class="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
      <div
        v-if="sftpStore.transfers.length === 0"
        class="py-8 text-center text-fg-muted text-[11px]"
      >
        {{ t('ui.queue.empty') }}
      </div>

      <div
        v-for="transfer in sftpStore.transfers"
        :key="transfer.transfer_id"
        class="p-2.5 rounded-xl bg-app/40 border border-line/80 space-y-1.5"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2 truncate">
            <Upload
              v-if="transfer.direction === 'upload'"
              class="w-3.5 h-3.5 text-accent shrink-0"
            />
            <Download v-else class="w-3.5 h-3.5 text-accent shrink-0" />
            <span class="font-medium text-fg truncate">{{ transfer.filename }}</span>
          </div>

          <div class="shrink-0 flex items-center space-x-1.5">
            <span
              v-if="transfer.status === 'queued'"
              class="text-warning/90 flex items-center space-x-1 text-[10px]"
            >
              <Clock class="w-3 h-3" />
              <span>{{ t('ui.queue.queued') }}</span>
            </span>
            <span
              v-else-if="transfer.status === 'completed'"
              class="text-success flex items-center space-x-1 text-[10px]"
            >
              <CheckCircle2 class="w-3 h-3" />
              <span>{{ t('ui.import.ready') }}</span>
            </span>
            <div
              v-else-if="transfer.status === 'error'"
              class="flex items-center space-x-1.5"
            >
              <span class="text-danger flex items-center space-x-1 text-[10px]">
                <AlertCircle class="w-3 h-3" />
                <span>{{ t('common.error') }}</span>
              </span>
              <button
                v-if="transfer.local_path && transfer.remote_path"
                @click="sftpStore.retryTransfer(transfer.transfer_id)"
                class="p-0.5 text-fg-muted hover:text-accent rounded transition cursor-pointer"
                :title="t('ui.queue.retry')"
              >
                <RotateCcw class="w-3 h-3" />
              </button>
            </div>
            <span v-else class="text-accent font-mono text-[10px]">
              {{ transfer.percentage.toFixed(0) }}%
            </span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="w-full bg-active h-1.5 rounded-full overflow-hidden">
          <div
            class="h-full transition-all duration-200"
            :class="{
              'bg-warning/40': transfer.status === 'queued',
              'bg-accent': transfer.status === 'in_progress',
              'bg-success': transfer.status === 'completed',
              'bg-danger': transfer.status === 'error',
            }"
            :style="{ width: transfer.status === 'queued' ? '100%' : `${Math.min(100, Math.max(0, transfer.percentage))}%` }"
          ></div>
        </div>

        <!-- Stats -->
        <div class="flex items-center justify-between text-[10px] text-fg-muted font-mono">
          <span v-if="transfer.status === 'queued'">
            {{ t('ui.queue.waiting') }}
          </span>
          <span v-else>
            {{ formatBytes(transfer.bytes_transferred) }} / {{ formatBytes(transfer.total_bytes) }}
          </span>

          <div class="flex items-center space-x-2">
            <span
              v-if="transfer.status === 'in_progress' && transfer.speed_bytes_sec && transfer.speed_bytes_sec > 0"
              class="text-fg-muted"
            >
              {{ formatBytes(transfer.speed_bytes_sec) }}/s
            </span>
            <span v-if="transfer.error_message" class="text-danger truncate max-w-[150px]">
              {{ transfer.error_message }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
