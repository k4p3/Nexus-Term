<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSessionsStore } from "../../stores/sessions.store";
import { useSftpStore } from "../../stores/sftp.store";
import SplitPaneNode from "./SplitPaneNode.vue";
import { Plus, X, Terminal, Sparkles, Radio, AlertTriangle, PanelLeft, FolderSync } from "lucide-vue-next";
import EmptyState from "../common/EmptyState.vue";
import BaseButton from "../common/BaseButton.vue";
import IconButton from "../common/IconButton.vue";

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

/** Remote tabs (any pane bound to a host) get a live-connection dot; local shells stay muted. */
function isRemoteTab(tabId: string): boolean {
  return sessionsStore.getLeafPanesInTab(tabId).some((l) => !!l.host);
}

function handleNewTab() {
  sessionsStore.createTab(t('terminal.newLocal'));
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full w-full bg-app overflow-hidden select-none">
    <!-- Tab Bar -->
    <div class="h-10 bg-header border-b border-line flex items-end justify-between px-2 shrink-0 select-none">
      <div class="flex items-end gap-0.5 min-w-0 overflow-x-auto h-full" role="tablist" :aria-label="t('terminal.activeSessions')">
        <div class="self-center mr-1">
          <IconButton
            :label="props.isSidebarVisible ? t('terminal.hideSidebar') : t('terminal.showSidebar')"
            :active="!props.isSidebarVisible"
            @click="emit('toggle-sidebar')"
          >
            <PanelLeft class="w-4 h-4" />
          </IconButton>
        </div>

        <div
          v-for="tab in sessionsStore.tabs"
          :key="tab.id"
          role="tab"
          tabindex="0"
          :aria-selected="sessionsStore.activeTabId === tab.id"
          @click="sessionsStore.activeTabId = tab.id"
          @keydown.enter.prevent="sessionsStore.activeTabId = tab.id"
          @keydown.space.prevent="sessionsStore.activeTabId = tab.id"
          class="group relative h-[34px] flex items-center gap-2 pl-3 pr-1.5 rounded-t-panel text-xs cursor-pointer border-t-2 transition-colors"
          :class="
            sessionsStore.activeTabId === tab.id
              ? 'bg-app text-fg font-medium border-accent'
              : 'text-fg-muted hover:text-fg hover:bg-active/60 border-transparent'
          "
        >
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0"
            :class="isRemoteTab(tab.id) ? 'bg-success' : 'bg-fg-muted/50'"
            aria-hidden="true"
          ></span>
          <span class="max-w-[150px] truncate">{{ tab.title }}</span>
          <button
            type="button"
            @click.stop="sessionsStore.closeTab(tab.id)"
            class="w-5 h-5 flex items-center justify-center rounded-control text-fg-muted hover:text-danger hover:bg-active opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition cursor-pointer"
            :class="sessionsStore.activeTabId === tab.id && 'opacity-70'"
            :title="t('terminal.closePane')"
            :aria-label="t('terminal.closePane')"
          >
            <X class="w-3 h-3" />
          </button>
        </div>

        <div class="self-center ml-1">
          <IconButton :label="t('terminal.newLocal')" @click="handleNewTab">
            <Plus class="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      <!-- Right toolbar: SFTP & Broadcast -->
      <div v-if="sessionsStore.tabs.length > 0" class="flex items-center gap-1.5 pl-2 self-center shrink-0">
        <BaseButton
          v-if="activeHost"
          variant="ghost"
          size="sm"
          :title="`SFTP · ${activeHost.label}`"
          @click="sftpStore.openSftp(activeHost.id)"
        >
          <FolderSync class="w-3.5 h-3.5" />
          <span>SFTP</span>
        </BaseButton>

        <button
          type="button"
          :aria-pressed="sessionsStore.isBroadcastMode"
          @click="sessionsStore.toggleBroadcastMode()"
          class="h-7 px-2.5 inline-flex items-center gap-1.5 text-xs rounded-control border transition-colors cursor-pointer"
          :class="
            sessionsStore.isBroadcastMode
              ? 'bg-warning/15 text-warning border-warning/40'
              : 'text-fg-muted border-transparent hover:text-fg hover:bg-active'
          "
          :title="sessionsStore.isBroadcastMode ? 'Desactivar Modo Broadcast' : 'Activar Modo Broadcast (Replicar teclas en todos los paneles)'"
        >
          <Radio class="w-3.5 h-3.5" :class="sessionsStore.isBroadcastMode && 'animate-pulse'" />
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
      <div v-if="sessionsStore.tabs.length === 0" class="h-full w-full flex items-center justify-center">
        <EmptyState :title="t('terminal.activeSessions')" :description="t('hosts.noHosts')">
          <template #icon><Terminal class="w-5 h-5" /></template>
          <BaseButton variant="primary" @click="handleNewTab">
            <Plus class="w-4 h-4" />
            <span>{{ t('terminal.newLocal') }}</span>
          </BaseButton>
        </EmptyState>
        <p class="absolute bottom-6 flex items-center gap-1.5 text-[11px] text-fg-muted">
          <Sparkles class="w-3.5 h-3.5 text-accent" aria-hidden="true" />
          <span>{{ t('hosts.quickConnect') }} <kbd class="px-1.5 py-0.5 rounded-control border border-line bg-surface font-mono">Ctrl+K</kbd></span>
        </p>
      </div>
    </div>
  </div>
</template>
