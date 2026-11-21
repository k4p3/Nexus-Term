<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useTunnelsStore } from "../../stores/tunnels.store";
import { useVaultStore } from "../../stores/vault.store";
import { useEnsureUnlocked } from "../../composables/useEnsureUnlocked";
import type { TunnelConfig, TunnelConfigPayload } from "../../types/tunnels";
import TunnelModal from "./TunnelModal.vue";
import {
  X,
  Plus,
  Play,
  Square,
  Edit2,
  Trash2,
  ArrowRightLeft,
  Server,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  RefreshCw,
} from "lucide-vue-next";

const { t } = useI18n();
const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const tunnelsStore = useTunnelsStore();
const vaultStore = useVaultStore();

const { runWithUnlock, ensureUnlocked } = useEnsureUnlocked();
const isModalOpen = ref(false);
const tunnelToEdit = ref<TunnelConfig | null>(null);
const actionLoading = ref<Record<string, boolean>>({});

onMounted(() => {
  tunnelsStore.fetchTunnels();
  tunnelsStore.startPolling(2000);
});

onUnmounted(() => {
  tunnelsStore.stopPolling();
});

function getHostLabel(hostId: string): string {
  const host = vaultStore.hosts.find((h) => h.id === hostId);
  return host ? `${host.label} (${host.hostname})` : t('ui.tunnels.unknownHost');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

async function openAddTunnel() {
  if (!(await ensureUnlocked())) return; // el selector de host usa la bóveda
  tunnelToEdit.value = null;
  isModalOpen.value = true;
}

function openEditTunnel(tunnel: TunnelConfig) {
  tunnelToEdit.value = tunnel;
  isModalOpen.value = true;
}

async function handleSaveTunnel(payload: TunnelConfigPayload) {
  await tunnelsStore.saveTunnel(payload);
}

async function handleDeleteTunnel(id: string) {
  if (confirm(t('ui.tunnels.confirmDelete'))) {
    await tunnelsStore.deleteTunnel(id);
  }
}

async function handleToggleTunnel(id: string) {
  actionLoading.value[id] = true;
  try {
    await runWithUnlock(() => tunnelsStore.toggleTunnel(id));
  } catch {
    // Error is set in store
  } finally {
    actionLoading.value[id] = false;
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    @click.self="emit('close')"
    class="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-xs p-4"
  >
    <div
      class="bg-surface border border-line/80 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col text-fg overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-line bg-app/40">
        <div class="flex items-center space-x-2.5">
          <div class="p-1.5 rounded-lg bg-accent/10 text-accent border border-accent/20">
            <ArrowRightLeft class="w-4 h-4" />
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h2 class="text-sm font-semibold text-fg">{{ t('ui.tunnels.title') }}</h2>
              <span
                v-if="tunnelsStore.activeTunnelsCount > 0"
                class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-success/20 text-success border border-success/30 animate-pulse"
              >
                {{ t('ui.tunnels.active', { n: tunnelsStore.activeTunnelsCount }) }}
              </span>
            </div>
            <p class="text-[11px] text-fg-muted">
              {{ t('ui.tunnels.subtitle') }}
            </p>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <button
            @click="openAddTunnel()"
            class="px-2.5 py-1.5 bg-accent hover:bg-accent-hover text-on-accent rounded-lg text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>{{ t('ui.tunnels.new') }}</span>
          </button>
          <button
            @click="emit('close')"
            class="text-fg-muted hover:text-fg p-1.5 rounded-lg hover:bg-active transition cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Tunnel List Body -->
      <div class="flex-1 overflow-y-auto p-4 space-y-2.5">
        <!-- Empty State -->
        <div
          v-if="tunnelsStore.tunnels.length === 0"
          class="p-8 text-center text-xs text-fg-muted space-y-3"
        >
          <div class="w-10 h-10 mx-auto rounded-full bg-active flex items-center justify-center text-fg-muted">
            <ArrowRightLeft class="w-5 h-5" />
          </div>
          <div>
            <p class="font-medium text-fg">{{ t('ui.tunnels.empty') }}</p>
            <p class="text-[11px] text-fg-muted mt-0.5">
              {{ t('ui.tunnels.emptyBody') }}
            </p>
          </div>
          <button
            @click="openAddTunnel()"
            class="px-3.5 py-1.5 bg-active hover:bg-active text-accent border border-line rounded-lg text-xs font-medium inline-flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>{{ t('ui.tunnels.createFirst') }}</span>
          </button>
        </div>

        <!-- Tunnel Cards -->
        <div
          v-for="tunnel in tunnelsStore.tunnels"
          :key="tunnel.id"
          class="p-3.5 rounded-xl bg-app/50 border border-line/80 hover:border-line transition flex flex-col space-y-2.5"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2.5 truncate">
              <!-- Status Indicator Dot -->
              <span class="relative flex h-2.5 w-2.5 shrink-0">
                <span
                  v-if="tunnelsStore.getTunnelStatus(tunnel.id).status === 'active'"
                  class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"
                ></span>
                <span
                  class="relative inline-flex rounded-full h-2.5 w-2.5"
                  :class="{
                    'bg-success': tunnelsStore.getTunnelStatus(tunnel.id).status === 'active',
                    'bg-active': tunnelsStore.getTunnelStatus(tunnel.id).status === 'stopped',
                    'bg-danger': tunnelsStore.getTunnelStatus(tunnel.id).status === 'error',
                  }"
                ></span>
              </span>

              <span class="font-medium text-xs text-fg truncate">{{ tunnel.name }}</span>

              <!-- Type Badge -->
              <span
                v-if="tunnel.tunnel_type === 'local'"
                class="px-2 py-0.5 text-[9px] font-mono rounded bg-accent/10 text-accent border border-accent/20 shrink-0"
              >
                Local -L
              </span>
              <span
                v-else-if="tunnel.tunnel_type === 'remote'"
                class="px-2 py-0.5 text-[9px] font-mono rounded bg-accent/10 text-accent border border-accent/20 shrink-0"
              >
                {{ t('ui.tunnels.remote') }}
              </span>
              <span
                v-else
                class="px-2 py-0.5 text-[9px] font-mono rounded bg-success/10 text-success border border-success/20 shrink-0"
              >
                SOCKS5 -D
              </span>
            </div>

            <!-- Action Controls -->
            <div class="flex items-center space-x-1 shrink-0">
              <!-- Start / Stop Toggle -->
              <button
                @click="handleToggleTunnel(tunnel.id)"
                :disabled="actionLoading[tunnel.id]"
                class="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer"
                :class="
                  tunnelsStore.getTunnelStatus(tunnel.id).status === 'active'
                    ? 'bg-warning/10 text-warning hover:bg-warning/20 border border-warning/30'
                    : 'bg-success/10 text-success hover:bg-success/20 border border-success/30'
                "
              >
                <Square
                  v-if="tunnelsStore.getTunnelStatus(tunnel.id).status === 'active'"
                  class="w-3 h-3 fill-current"
                />
                <Play v-else class="w-3 h-3 fill-current" />
                <span>
                  {{ tunnelsStore.getTunnelStatus(tunnel.id).status === "active" ? "Detener" : "Iniciar" }}
                </span>
              </button>

              <button
                @click="openEditTunnel(tunnel)"
                class="p-1.5 text-fg-muted hover:text-fg hover:bg-active rounded-lg transition cursor-pointer"
                :title="t('common.edit')"
              >
                <Edit2 class="w-3.5 h-3.5" />
              </button>
              <button
                @click="handleDeleteTunnel(tunnel.id)"
                class="p-1.5 text-fg-muted hover:text-danger hover:bg-active rounded-lg transition cursor-pointer"
                :title="t('common.delete')"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Mapping & Host details -->
          <div class="flex items-center justify-between text-[11px] text-fg-muted pt-1 border-t border-line/40 font-mono">
            <div class="flex items-center space-x-2 truncate">
              <span class="text-fg font-medium">
                {{ tunnel.local_host }}:{{ tunnel.local_port }}
              </span>
              <span class="text-fg-muted">
                {{ tunnel.tunnel_type === 'remote' ? '←' : '→' }}
              </span>
              <span v-if="tunnel.tunnel_type !== 'dynamic'" class="text-fg">
                {{ tunnel.remote_host }}:{{ tunnel.remote_port }}
              </span>
              <span v-else class="text-success">
                {{ t('ui.tunnels.dynamic') }}
              </span>
            </div>

            <div class="flex items-center space-x-1.5 text-[10px] text-fg-muted shrink-0 font-sans">
              <Server class="w-3 h-3" />
              <span class="truncate max-w-[150px]">{{ getHostLabel(tunnel.host_id) }}</span>
            </div>
          </div>

          <!-- Telemetry Stats or Error Info -->
          <div
            v-if="tunnelsStore.getTunnelStatus(tunnel.id).status === 'active'"
            class="flex items-center justify-between text-[10px] text-fg-muted bg-surface/60 px-2.5 py-1.5 rounded-lg border border-line/60"
          >
            <div class="flex items-center space-x-3 font-mono">
              <span class="flex items-center space-x-1 text-accent">
                <ArrowUpRight class="w-3 h-3" />
                <span>{{ formatBytes(tunnelsStore.getTunnelStatus(tunnel.id).bytes_sent) }}</span>
              </span>
              <span class="flex items-center space-x-1 text-success">
                <ArrowDownLeft class="w-3 h-3" />
                <span>{{ formatBytes(tunnelsStore.getTunnelStatus(tunnel.id).bytes_received) }}</span>
              </span>
            </div>

            <div class="flex items-center space-x-1 text-fg-muted font-sans">
              <Activity class="w-3 h-3 text-success" />
              <span>{{ t('ui.tunnels.connections', { n: tunnelsStore.getTunnelStatus(tunnel.id).active_connections }) }}</span>
            </div>
          </div>

          <div
            v-else-if="tunnelsStore.getTunnelStatus(tunnel.id).status === 'error'"
            class="flex items-center space-x-1.5 text-[10px] text-danger bg-danger/10 border border-danger/20 px-2.5 py-1.5 rounded-lg"
          >
            <AlertCircle class="w-3.5 h-3.5 shrink-0" />
            <span>{{ tunnelsStore.getTunnelStatus(tunnel.id).error_message || t('ui.tunnels.connectFailed') }}</span>
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="px-5 py-2.5 border-t border-line bg-app/60 flex items-center justify-between text-[11px] text-fg-muted">
        <span>{{ t('ui.tunnels.footer') }}</span>
        <button
          @click="tunnelsStore.refreshStatuses()"
          class="hover:text-fg transition flex items-center space-x-1 cursor-pointer"
        >
          <RefreshCw class="w-3 h-3" />
          <span>{{ t('ui.tunnels.update') }}</span>
        </button>
      </div>
    </div>

    <!-- Edit/Create Modal -->
    <TunnelModal
      :is-open="isModalOpen"
      :tunnel-to-edit="tunnelToEdit"
      @close="isModalOpen = false"
      @save="handleSaveTunnel"
    />
  </div>
</template>
