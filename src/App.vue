<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useVaultStore } from "./stores/vault.store";
import { useSessionsStore } from "./stores/sessions.store";
import { useSettingsStore } from "./stores/settings.store";
import VaultUnlockScreen from "./components/vault/VaultUnlockScreen.vue";
import HostTreeSidebar from "./components/hosts/HostTreeSidebar.vue";
import QuickConnectModal from "./components/hosts/QuickConnectModal.vue";
import SettingsModal from "./components/settings/SettingsModal.vue";
import SnippetDrawer from "./components/snippets/SnippetDrawer.vue";
import TerminalWorkspace from "./components/terminal/TerminalWorkspace.vue";
import type { HostSummary } from "./types/inventory";
import { sessionService } from "./services/session.service";
import { Lock, Terminal, RefreshCw, Search, Settings, Code } from "lucide-vue-next";

const { t } = useI18n();
const vaultStore = useVaultStore();
const sessionsStore = useSessionsStore();
const settingsStore = useSettingsStore();

const isQuickConnectOpen = ref(false);
const isSettingsOpen = ref(false);
const isSnippetsOpen = ref(false);
const isSidebarVisible = ref(true);

onMounted(async () => {
  await settingsStore.loadSettings();
  await vaultStore.checkStatus();
  window.addEventListener("keydown", handleGlobalKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeyDown);
});

function handleGlobalKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (vaultStore.isUnlocked) {
      isQuickConnectOpen.value = !isQuickConnectOpen.value;
    }
  } else if ((e.ctrlKey || e.metaKey) && e.key === ",") {
    e.preventDefault();
    isSettingsOpen.value = !isSettingsOpen.value;
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
    e.preventDefault();
    if (e.shiftKey) {
      sessionsStore.toggleBroadcastMode();
    } else if (vaultStore.isUnlocked) {
      isSidebarVisible.value = !isSidebarVisible.value;
    }
  }
}

function handleConnectHost(host: HostSummary) {
  sessionsStore.createTab(host.label, host);
}

function handleOpenLocalPty() {
  sessionsStore.createTab(t('terminal.newLocal'));
}

function handleInsertCommand(command: string) {
  if (!sessionsStore.activeTabId) return;
  const tab = sessionsStore.tabs.find((t) => t.id === sessionsStore.activeTabId);
  if (!tab) return;
  const sessionId = sessionsStore.paneSessionMap[tab.activePaneId];
  if (sessionId) {
    sessionService.writeSession(sessionId, new TextEncoder().encode(command));
  }
}
</script>

<template>
  <div class="h-full w-full flex flex-col bg-theme-app text-theme-main select-none">
    <!-- Top Application Bar -->
    <header class="h-10 bg-theme-header border-b border-theme flex items-center px-3.5 justify-between select-none shrink-0 z-20">
      <div class="flex items-center space-x-2.5">
        <div class="w-6 h-6 rounded-lg bg-theme-accent flex items-center justify-center shadow-xs">
          <Terminal class="w-3.5 h-3.5 text-slate-950 font-bold" />
        </div>
        <span class="text-sm font-bold tracking-tight text-theme-main flex items-center space-x-1">
          <span>Nexus</span><span class="text-theme-accent">Term</span>
        </span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-sm bg-theme-active text-theme-muted font-mono">v0.1</span>
      </div>

      <div class="flex items-center space-x-2">
        <button
          v-if="vaultStore.isUnlocked"
          @click="isQuickConnectOpen = true"
          :title="t('hosts.quickConnect')"
          class="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-theme-muted hover:text-theme-main bg-theme-surface hover:bg-theme-active border border-theme rounded-lg transition-colors cursor-pointer"
        >
          <Search class="w-3.5 h-3.5 text-theme-accent" />
          <span>{{ t('common.search') }}</span>
          <kbd class="ml-1 text-[10px] font-mono bg-theme-header px-1 py-0.2 rounded-sm border border-theme text-theme-muted">
            Ctrl+K
          </kbd>
        </button>

        <button
          v-if="vaultStore.isUnlocked"
          @click="isSnippetsOpen = !isSnippetsOpen"
          title="Biblioteca de Snippets"
          class="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-theme-muted hover:text-theme-main bg-theme-surface hover:bg-theme-active border border-theme rounded-lg transition-colors cursor-pointer"
        >
          <Code class="w-3.5 h-3.5 text-theme-accent" />
          <span>Snippets</span>
        </button>

        <button
          @click="isSettingsOpen = true"
          :title="t('settings.title')"
          class="p-1.5 text-theme-muted hover:text-theme-main bg-theme-surface hover:bg-theme-active border border-theme rounded-lg transition-colors cursor-pointer"
        >
          <Settings class="w-3.5 h-3.5 text-theme-muted" />
        </button>

        <button
          v-if="vaultStore.isUnlocked"
          @click="vaultStore.lock()"
          :title="t('vault.lockVault')"
          class="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-theme-muted hover:text-theme-main bg-theme-surface hover:bg-theme-active border border-theme rounded-lg transition-colors cursor-pointer"
        >
          <Lock class="w-3.5 h-3.5 text-amber-400" />
          <span>{{ t('vault.lockVault') }}</span>
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 overflow-hidden relative flex">
      <div v-if="vaultStore.isLoading && !vaultStore.isInitialized && !vaultStore.isUnlocked" class="h-full w-full flex items-center justify-center">
        <RefreshCw class="w-6 h-6 text-cyan-400 animate-spin" />
      </div>

      <VaultUnlockScreen v-else-if="!vaultStore.isUnlocked" />

      <div v-else class="h-full w-full flex overflow-hidden">
        <!-- Collapsible Sidebar -->
        <HostTreeSidebar
          v-show="isSidebarVisible"
          @connect-host="handleConnectHost"
          @open-local-pty="handleOpenLocalPty"
          @toggle-sidebar="isSidebarVisible = false"
        />

        <!-- Terminal Workspace (Tabs + Split Panes) -->
        <TerminalWorkspace
          :is-sidebar-visible="isSidebarVisible"
          @toggle-sidebar="isSidebarVisible = !isSidebarVisible"
        />

        <!-- Quick Connect Palette Modal -->
        <QuickConnectModal
          :is-open="isQuickConnectOpen"
          @close="isQuickConnectOpen = false"
          @connect-host="handleConnectHost"
          @open-local-pty="handleOpenLocalPty"
          @open-settings="isSettingsOpen = true"
          @open-snippets="isSnippetsOpen = true"
          @insert-command="handleInsertCommand"
        />
      </div>

      <!-- Settings Modal -->
      <SettingsModal
        v-if="isSettingsOpen"
        @close="isSettingsOpen = false"
      />

      <!-- Snippets Drawer -->
      <SnippetDrawer
        :is-open="isSnippetsOpen"
        @close="isSnippetsOpen = false"
        @insert-command="handleInsertCommand"
      />
    </main>
  </div>
</template>
