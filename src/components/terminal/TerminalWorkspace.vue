<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSessionsStore } from "../../stores/sessions.store";
import SplitPaneNode from "./SplitPaneNode.vue";
import { Plus, X, Terminal, Server, Sparkles, Radio, AlertTriangle, PanelLeft } from "lucide-vue-next";

const { t } = useI18n();
const sessionsStore = useSessionsStore();

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

function handleNewTab() {
  sessionsStore.createTab(t('terminal.newLocal'));
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full w-full bg-theme-app overflow-hidden select-none">
    <!-- Tab Bar -->
    <div class="h-9 bg-theme-header border-b border-theme flex items-center justify-between px-2 overflow-x-auto shrink-0 select-none">
      <div class="flex items-center space-x-1">
        <!-- Sidebar Toggle Button (Integrated in Tab Bar) -->
        <button
          @click="emit('toggle-sidebar')"
          :title="props.isSidebarVisible ? 'Ocultar Barra Lateral (Ctrl+B)' : 'Mostrar Barra Lateral (Ctrl+B)'"
          class="p-1.5 rounded-md transition-colors cursor-pointer mr-0.5 flex items-center justify-center shrink-0"
          :class="!props.isSidebarVisible ? 'text-theme-accent bg-theme-active border border-theme hover:brightness-110' : 'text-theme-muted hover:text-theme-main hover:bg-theme-active'"
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
              ? 'bg-theme-app text-theme-accent border-theme-accent font-semibold'
              : 'text-theme-muted hover:text-theme-main hover:bg-theme-active/60 border-transparent'
          "
        >
          <Terminal class="w-3.5 h-3.5 shrink-0" />
          <span class="max-w-[140px] truncate">{{ tab.title }}</span>
          <button
            @click.stop="sessionsStore.closeTab(tab.id)"
            class="p-0.5 rounded text-theme-muted hover:text-red-400 opacity-60 group-hover:opacity-100 transition cursor-pointer"
            :title="t('terminal.closePane')"
          >
            <X class="w-3 h-3" />
          </button>
        </div>

        <button
          @click="handleNewTab"
          :title="t('terminal.newLocal')"
          class="p-1.5 text-theme-muted hover:text-theme-accent hover:bg-theme-active rounded-lg transition cursor-pointer"
        >
          <Plus class="w-4 h-4" />
        </button>
      </div>

      <!-- Right Tab Toolbar: Broadcast Toggle -->
      <div v-if="sessionsStore.tabs.length > 0" class="flex items-center space-x-2 pl-2">
        <button
          @click="sessionsStore.toggleBroadcastMode()"
          :class="[
            'flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer',
            sessionsStore.isBroadcastMode
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 bg-slate-800/60 border-slate-700/60 hover:bg-slate-800',
          ]"
          :title="sessionsStore.isBroadcastMode ? 'Desactivar Modo Broadcast' : 'Activar Modo Broadcast (Replicar teclas en todos los paneles)'"
        >
          <Radio class="w-3.5 h-3.5" :class="sessionsStore.isBroadcastMode ? 'animate-pulse text-amber-400' : ''" />
          <span>Broadcast</span>
        </button>
      </div>
    </div>

    <!-- Broadcast Mode Warning Banner -->
    <div
      v-if="sessionsStore.isBroadcastMode"
      class="h-7 bg-amber-500/15 border-b border-amber-500/30 px-3 flex items-center justify-between text-xs text-amber-300 font-medium select-none shrink-0"
    >
      <div class="flex items-center space-x-2">
        <AlertTriangle class="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>MODO BROADCAST ACTIVO: Todas las teclas se enviarán a los paneles divididos abiertos.</span>
      </div>
      <button
        @click="sessionsStore.toggleBroadcastMode()"
        class="text-[11px] underline hover:text-white cursor-pointer"
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
        <div class="p-4 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-4 shadow-xl">
          <Terminal class="w-10 h-10" />
        </div>
        <h3 class="text-xl font-bold text-white mb-2">{{ t('terminal.activeSessions') }}</h3>
        <p class="text-xs text-slate-400 max-w-sm mb-6">
          {{ t('hosts.noHosts') }}
        </p>

        <div class="flex items-center space-x-3">
          <button
            @click="handleNewTab"
            class="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold rounded-xl text-xs shadow-lg shadow-cyan-500/20 flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Plus class="w-4 h-4" />
            <span>{{ t('terminal.newLocal') }}</span>
          </button>
        </div>

        <div class="mt-8 flex items-center space-x-2 text-[11px] text-slate-500">
          <Sparkles class="w-3.5 h-3.5 text-cyan-400" />
          <span>{{ t('hosts.quickConnect') }} (Ctrl+K)</span>
        </div>
      </div>
    </div>
  </div>
</template>
