<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSessionsStore } from "../../stores/sessions.store";
import { useSftpStore } from "../../stores/sftp.store";
import SplitPaneNode from "./SplitPaneNode.vue";
import { Plus, X, Terminal, Server, Sparkles, Radio, AlertTriangle, PanelLeft, FolderSync } from "lucide-vue-next";

const { t } = useI18n();
const sessionsStore = useSessionsStore();
const sftpStore = useSftpStore();

const props = withDefaults(
  defineProps<{
    isSidebarVisible?: boolean;
  }>(),
  {
    isSidebarVisible: true,
  }
);

const emit = defineEmits<{
  (e: "toggle-sidebar"): void;
}>();

const activeTab = computed(() => {
  return sessionsStore.tabs.find((t) => t.id === sessionsStore.activeTabId) || null;
});

const activeHost = computed(() => {
  if (!sessionsStore.activeTabId) return null;
  const leaves = sessionsStore.getLeafPanesInTab(sessionsStore.activeTabId);
  const activePane = leaves.find((l) => l.id === activeTab.value?.activePaneId) || leaves[0];
  return activePane?.host || null;
});

function handleNewTab() {
  sessionsStore.createTab(t('terminal.newLocal'));
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full w-full bg-app overflow-hidden select-none">
    <!-- Tab Bar -->
    <div class="h-9 bg-header border-b border-line flex items-center justify-between px-2 overflow-x-auto shrink-0 select-none">
      <div class="flex items-center space-x-1">
        <!-- Sidebar Toggle Button (Integrated in Tab Bar) -->
        <button
          @click="emit('toggle-sidebar')"
          :title="props.isSidebarVisible ? 'Ocultar Barra Lateral (Ctrl+B)' : 'Mostrar Barra Lateral (Ctrl+B)'"
          class="p-1.5 rounded-md transition-colors cursor-pointer mr-0.5 flex items-center justify-center shrink-0"
          :class="!props.isSidebarVisible ? 'text-accent bg-active border border-line hover:brightness-110' : 'text-fg-muted hover:text-fg hover:bg-active'"
        >
          <PanelLeft class="w-3.5 h-3.5" />
        </button>

        <div
          v-for="tab in sessionsStore.tabs"
          :key="tab.id"
          @click="sessionsStore.activeTabId = tab.id"
          class="group flex items-center space-x-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition border-b-2"
          :class="
            sessionsStore.activeTabId === tab.id
              ? 'bg-app text-accent border-accent font-semibold'
              : 'text-fg-muted hover:text-fg hover:bg-active/60 border-transparent'
          "
        >
          <Terminal class="w-3.5 h-3.5 shrink-0" />
          <span class="max-w-[140px] truncate">{{ tab.title }}</span>
          <button
            @click.stop="sessionsStore.closeTab(tab.id)"
            class="p-0.5 rounded text-fg-muted hover:text-danger opacity-60 group-hover:opacity-100 transition cursor-pointer"
            :title="t('terminal.closePane')"
          >
            <X class="w-3 h-3" />
          </button>
        </div>

        <button
          @click="handleNewTab"
          :title="t('terminal.newLocal')"
          class="p-1.5 text-fg-muted hover:text-accent hover:bg-active rounded-lg transition cursor-pointer"
        >
          <Plus class="w-4 h-4" />
        </button>
      </div>

      <!-- Right Tab Toolbar: SFTP & Broadcast Toggle -->
      <div v-if="sessionsStore.tabs.length > 0" class="flex items-center space-x-2 pl-2">
        <button
          v-if="activeHost"
          @click="sftpStore.openSftp(activeHost.id)"
          class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-warning/40 bg-warning/10 text-warning hover:bg-warning/20 transition cursor-pointer"
          :title="`Abrir Explorador SFTP para ${activeHost.label}`"
        >
          <FolderSync class="w-3.5 h-3.5 text-warning" />
          <span>SFTP</span>
        </button>

        <button
          @click="sessionsStore.toggleBroadcastMode()"
          :class="[
            'flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer',
            sessionsStore.isBroadcastMode
              ? 'bg-warning/20 text-warning border-warning/60 shadow-xs'
              : 'text-fg400 hover:text-fg200 bg-active800 border-line700 hover:bg-active800',
          ]"
          :title="sessionsStore.isBroadcastMode ? 'Desactivar Modo Broadcast' : 'Activar Modo Broadcast (Replicar teclas en todos los paneles)'"
        >
          <Radio class="w-3.5 h-3.5" :class="sessionsStore.isBroadcastMode ? 'animate-pulse text-warning' : ''" />
          <span>Broadcast</span>
        </button>
      </div>
    </div>

    <!-- Broadcast Mode Warning Banner -->
    <div
      v-if="sessionsStore.isBroadcastMode"
      class="h-7 bg-warning/15 border-b border-warning/30 px-3 flex items-center justify-between text-xs text-warning font-medium select-none shrink-0"
    >
      <div class="flex items-center space-x-2">
        <AlertTriangle class="w-3.5 h-3.5 text-warning shrink-0" />
        <span>MODO BROADCAST ACTIVO: Todas las teclas se enviarán a los paneles divididos abiertos.</span>
      </div>
      <button
        @click="sessionsStore.toggleBroadcastMode()"
        class="text-[11px] underline hover:text-fg cursor-pointer"
      >
        Desactivar
      </button>
    </div>

    <!-- Tab Workspaces (Persistent across tab switching without layout thrashing) -->
    <div class="flex-1 overflow-hidden relative">
      <div
        v-for="tab in sessionsStore.tabs"
        :key="tab.id"
        class="absolute inset-0 w-full h-full"
        :class="tab.id === sessionsStore.activeTabId ? 'z-10 visible' : 'z-0 invisible pointer-events-none'"
      >
        <SplitPaneNode
          v-if="!tab.pending || tab.id === sessionsStore.activeTabId"
          :node="tab.rootPane"
          :tab-id="tab.id"
          :active-pane-id="tab.activePaneId"
        />
      </div>

      <!-- Empty State -->
      <div
        v-if="sessionsStore.tabs.length === 0"
        class="h-full w-full flex flex-col items-center justify-center p-8 text-center"
      >
        <div class="p-4 rounded-3xl bg-accent/10 border border-accent/20 text-accent mb-4 shadow-xl">
          <Terminal class="w-10 h-10" />
        </div>
        <h3 class="text-xl font-bold text-fg mb-2">{{ t('terminal.activeSessions') }}</h3>
        <p class="text-xs text-fg400 max-w-sm mb-6">
          {{ t('hosts.noHosts') }}
        </p>

        <div class="flex items-center space-x-3">
          <button
            @click="handleNewTab"
            class="px-4 py-2 bg-accent hover:bg-accent-hover text-on-accent font-semibold rounded-xl text-xs shadow-lg shadow-accent/20 flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Plus class="w-4 h-4" />
            <span>{{ t('terminal.newLocal') }}</span>
          </button>
        </div>

        <div class="mt-8 flex items-center space-x-2 text-[11px] text-fg500">
          <Sparkles class="w-3.5 h-3.5 text-accent" />
          <span>{{ t('hosts.quickConnect') }} (Ctrl+K)</span>
        </div>
      </div>
    </div>
  </div>
</template>
