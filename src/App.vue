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
import TerminalWorkspace from "./components/terminal/TerminalWorkspace.vue";
import type { HostSummary } from "./types/inventory";
import { Lock, Terminal, RefreshCw, Search, Settings } from "lucide-vue-next";

const { t } = useI18n();
const vaultStore = useVaultStore();
const sessionsStore = useSessionsStore();
const settingsStore = useSettingsStore();

const isQuickConnectOpen = ref(false);
const isSettingsOpen = ref(false);

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
  }
}

function handleConnectHost(host: HostSummary) {
  sessionsStore.createTab(host.label, host);
}

function handleOpenLocalPty() {
  sessionsStore.createTab(t('terminal.newLocal'));
}
</script>

<template>
  <div class="h-full w-full flex flex-col bg-slate-950 text-slate-100 select-none">
    <!-- Top Application Bar -->
    <header class="h-10 bg-slate-900 border-b border-slate-800/80 flex items-center px-3.5 justify-between select-none shrink-0 z-20">
      <div class="flex items-center space-x-2.5">
        <div class="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-xs">
          <Terminal class="w-3.5 h-3.5 text-slate-950 font-bold" />
        </div>
        <span class="text-sm font-bold tracking-tight text-white flex items-center space-x-1">
          <span>Nexus</span><span class="text-cyan-400">Term</span>
        </span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-400 font-mono">v0.1</span>
      </div>

      <div class="flex items-center space-x-2">
        <button
          v-if="vaultStore.isUnlocked"
          @click="isQuickConnectOpen = true"
          :title="t('hosts.quickConnect')"
          class="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors cursor-pointer"
        >
          <Search class="w-3.5 h-3.5 text-cyan-400" />
          <span>{{ t('common.search') }}</span>
          <kbd class="ml-1 text-[10px] font-mono bg-slate-900 px-1 py-0.2 rounded-sm border border-slate-700 text-slate-400">
            Ctrl+K
          </kbd>
        </button>

        <button
          @click="isSettingsOpen = true"
          :title="t('settings.title')"
          class="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors cursor-pointer"
        >
          <Settings class="w-3.5 h-3.5 text-slate-300" />
        </button>

        <button
          v-if="vaultStore.isUnlocked"
          @click="vaultStore.lock()"
          :title="t('vault.lockVault')"
          class="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition-colors cursor-pointer"
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
        <!-- Sidebar -->
        <HostTreeSidebar
          @connect-host="handleConnectHost"
          @open-local-pty="handleOpenLocalPty"
        />

        <!-- Terminal Workspace (Tabs + Split Panes) -->
        <TerminalWorkspace />

        <!-- Quick Connect Palette Modal -->
        <QuickConnectModal
          :is-open="isQuickConnectOpen"
          @close="isQuickConnectOpen = false"
          @connect-host="handleConnectHost"
          @open-local-pty="handleOpenLocalPty"
          @open-settings="isSettingsOpen = true"
        />
      </div>

      <!-- Settings Modal -->
      <SettingsModal
        v-if="isSettingsOpen"
        @close="isSettingsOpen = false"
      />
    </main>
  </div>
</template>
