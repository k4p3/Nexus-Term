<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSessionsStore } from "../../stores/sessions.store";
import SplitPaneNode from "./SplitPaneNode.vue";
import { Plus, X, Terminal, Server, Sparkles } from "lucide-vue-next";

const { t } = useI18n();
const sessionsStore = useSessionsStore();

const activeTab = computed(() => {
  return sessionsStore.tabs.find((t) => t.id === sessionsStore.activeTabId) || null;
});

function handleNewTab() {
  sessionsStore.createTab(t('terminal.newLocal'));
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full w-full bg-slate-950 overflow-hidden select-none">
    <!-- Tab Bar -->
    <div class="h-9 bg-slate-900/80 border-b border-slate-800 flex items-center px-2 space-x-1 overflow-x-auto shrink-0 select-none">
      <div
        v-for="tab in sessionsStore.tabs"
        :key="tab.id"
        @click="sessionsStore.activeTabId = tab.id"
        class="group flex items-center space-x-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition border-b-2"
        :class="
          sessionsStore.activeTabId === tab.id
            ? 'bg-slate-950 text-cyan-400 border-cyan-400 font-semibold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'
        "
      >
        <Terminal class="w-3.5 h-3.5 shrink-0" />
        <span class="max-w-[140px] truncate">{{ tab.title }}</span>
        <button
          @click.stop="sessionsStore.closeTab(tab.id)"
          class="p-0.5 rounded text-slate-400 hover:text-red-400 opacity-60 group-hover:opacity-100 transition"
          :title="t('terminal.closePane')"
        >
          <X class="w-3 h-3" />
        </button>
      </div>

      <button
        @click="handleNewTab"
        :title="t('terminal.newLocal')"
        class="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition"
      >
        <Plus class="w-4 h-4" />
      </button>
    </div>

    <!-- Active Tab Workspace -->
    <div class="flex-1 overflow-hidden relative">
      <SplitPaneNode
        v-if="activeTab"
        :node="activeTab.rootPane"
        :tab-id="activeTab.id"
        :active-pane-id="activeTab.activePaneId"
      />

      <!-- Empty State -->
      <div
        v-else
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
