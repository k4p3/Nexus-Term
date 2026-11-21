<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useTelemetryStore } from "../../stores/telemetry.store";
import {
  Cpu,
  Layers,
  HardDrive,
  ArrowDown,
  ArrowUp,
  Clock,
  Activity,
  Pause,
  Play,
  X,
  RefreshCw,
} from "lucide-vue-next";

const props = defineProps<{
  hostId: string;
  paneId: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const telemetryStore = useTelemetryStore();

onMounted(() => {
  telemetryStore.startMonitoring(props.hostId);
});

const snapshot = computed(() => {
  return telemetryStore.currentSnapshots[props.hostId] || null;
});

const isPaused = computed(() => {
  return telemetryStore.isPaused[props.hostId] || false;
});

function getCpuColorClass(percent: number): { text: string; bg: string } {
  if (percent >= 85) return { text: "text-danger", bg: "bg-danger" };
  if (percent >= 70) return { text: "text-warning", bg: "bg-warning" };
  return { text: "text-success", bg: "bg-success" };
}

function getMemoryColorClass(percent: number): { text: string; bg: string } {
  if (percent >= 85) return { text: "text-danger", bg: "bg-danger" };
  if (percent >= 70) return { text: "text-warning", bg: "bg-warning" };
  return { text: "text-accent", bg: "bg-accent" };
}
</script>

<template>
  <div
    class="bg-surface/95 border-b border-line px-3 py-1 flex items-center justify-between text-xs select-none shrink-0 font-mono text-fg-muted transition-all backdrop-blur-xs z-10"
  >
    <!-- Left: Loading or Metrics Items -->
    <div v-if="!snapshot" class="flex items-center space-x-2 py-0.5 text-[11px] text-fg-muted">
      <RefreshCw class="w-3.5 h-3.5 animate-spin text-accent" />
      <span>Conectando canal de telemetría remota...</span>
    </div>

    <div v-else class="flex items-center space-x-4 overflow-x-auto py-0.5 no-scrollbar">
      <!-- CPU Metric -->
      <div class="flex items-center space-x-1.5 shrink-0" :title="`CPU (${snapshot.cpu.cores_count} cores)`">
        <Cpu class="w-3.5 h-3.5 shrink-0" :class="getCpuColorClass(snapshot.cpu.total_usage_percent).text" />
        <span class="text-[10px] text-fg-muted uppercase font-sans font-semibold">CPU</span>
        <span class="font-bold text-[11px]" :class="getCpuColorClass(snapshot.cpu.total_usage_percent).text">
          {{ snapshot.cpu.total_usage_percent }}%
        </span>
        <!-- Mini Progress Bar -->
        <div class="w-10 h-1.5 bg-app rounded-full overflow-hidden border border-line shrink-0">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="getCpuColorClass(snapshot.cpu.total_usage_percent).bg"
            :style="{ width: `${Math.min(100, Math.max(0, snapshot.cpu.total_usage_percent))}%` }"
          ></div>
        </div>
      </div>

      <!-- RAM Metric -->
      <div class="flex items-center space-x-1.5 shrink-0" :title="`RAM: ${telemetryStore.formatBytes(snapshot.memory.used_bytes)} / ${telemetryStore.formatBytes(snapshot.memory.total_bytes)}`">
        <Layers class="w-3.5 h-3.5 shrink-0" :class="getMemoryColorClass(snapshot.memory.usage_percent).text" />
        <span class="text-[10px] text-fg-muted uppercase font-sans font-semibold">RAM</span>
        <span class="font-bold text-[11px]" :class="getMemoryColorClass(snapshot.memory.usage_percent).text">
          {{ snapshot.memory.usage_percent }}%
        </span>
        <span class="text-[10px] text-fg-muted">
          {{ telemetryStore.formatBytes(snapshot.memory.used_bytes) }}
        </span>
        <!-- Mini Progress Bar -->
        <div class="w-10 h-1.5 bg-app rounded-full overflow-hidden border border-line shrink-0">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="getMemoryColorClass(snapshot.memory.usage_percent).bg"
            :style="{ width: `${Math.min(100, Math.max(0, snapshot.memory.usage_percent))}%` }"
          ></div>
        </div>
      </div>

      <!-- Disk Metric -->
      <div class="flex items-center space-x-1.5 shrink-0" :title="`Disco raíz (/): ${telemetryStore.formatBytes(snapshot.disk.used_bytes)} / ${telemetryStore.formatBytes(snapshot.disk.total_bytes)}`">
        <HardDrive class="w-3.5 h-3.5 text-accent shrink-0" />
        <span class="text-[10px] text-fg-muted uppercase font-sans font-semibold">Disco</span>
        <span class="font-bold text-[11px] text-fg">
          {{ snapshot.disk.usage_percent }}%
        </span>
      </div>

      <!-- Network Rx / Tx -->
      <div class="flex items-center space-x-2 shrink-0">
        <div class="flex items-center space-x-0.5 text-success text-[11px]" title="Velocidad de descarga (Rx)">
          <ArrowDown class="w-3 h-3 shrink-0" />
          <span>{{ telemetryStore.formatSpeed(snapshot.network.rx_bytes_per_sec) }}</span>
        </div>
        <div class="flex items-center space-x-0.5 text-accent text-[11px]" title="Velocidad de subida (Tx)">
          <ArrowUp class="w-3 h-3 shrink-0" />
          <span>{{ telemetryStore.formatSpeed(snapshot.network.tx_bytes_per_sec) }}</span>
        </div>
      </div>

      <!-- Load Average -->
      <div class="flex items-center space-x-1 shrink-0 text-[11px]" :title="`Load average: 1m=${snapshot.load_avg[0]}, 5m=${snapshot.load_avg[1]}, 15m=${snapshot.load_avg[2]}`">
        <Activity class="w-3 h-3 text-warning shrink-0" />
        <span class="text-[10px] text-fg-muted">Load:</span>
        <span class="text-fg font-semibold">
          {{ snapshot.load_avg[0].toFixed(2) }}
        </span>
      </div>

      <!-- Uptime -->
      <div class="flex items-center space-x-1 shrink-0 text-[11px]" title="Tiempo de actividad del servidor">
        <Clock class="w-3 h-3 text-fg400 shrink-0" />
        <span class="text-[10px] text-fg-muted">Up:</span>
        <span class="text-fg">
          {{ telemetryStore.formatUptime(snapshot.uptime_seconds) }}
        </span>
      </div>
    </div>

    <!-- Right Controls: Pause & Close -->
    <div class="flex items-center space-x-1 shrink-0 pl-2">
      <button
        @click="telemetryStore.togglePause(props.hostId)"
        :title="isPaused ? 'Reanudar telemetría' : 'Pausar telemetría'"
        class="p-1 rounded-md text-fg-muted hover:text-fg hover:bg-active transition cursor-pointer"
      >
        <Play v-if="isPaused" class="w-3 h-3 text-success" />
        <Pause v-else class="w-3 h-3" />
      </button>

      <button
        @click="emit('close')"
        title="Ocultar barra de telemetría"
        class="p-1 rounded-md text-fg-muted hover:text-danger hover:bg-active transition cursor-pointer"
      >
        <X class="w-3 h-3" />
      </button>
    </div>
  </div>
</template>
