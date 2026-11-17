<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";
import { useVaultStore } from "./stores/vault.store";
import { useSessionsStore } from "./stores/sessions.store";
import { useSettingsStore } from "./stores/settings.store";
import { useTunnelsStore } from "./stores/tunnels.store";
import { useSftpStore } from "./stores/sftp.store";
import VaultUnlockScreen from "./components/vault/VaultUnlockScreen.vue";
import HostTreeSidebar from "./components/hosts/HostTreeSidebar.vue";
import TerminalWorkspace from "./components/terminal/TerminalWorkspace.vue";
import ToastHost from "./components/common/ToastHost.vue";
import { useSessionRestore } from "./composables/useSessionRestore";
import { useUiStore } from "./stores/ui.store";
import { matchShortcut } from "./utils/shortcuts";
import type { HostSummary } from "./types/inventory";
import { sessionService } from "./services/session.service";
import { Lock, RefreshCw, Search, Settings, Code, ArrowRightLeft, FolderSync } from "lucide-vue-next";

// Modales y paneles secundarios cargados bajo demanda (lazy loading) para reducir memoria inicial
const QuickConnectModal = defineAsyncComponent(() => import("./components/hosts/QuickConnectModal.vue"));
const SettingsModal = defineAsyncComponent(() => import("./components/settings/SettingsModal.vue"));
const SnippetDrawer = defineAsyncComponent(() => import("./components/snippets/SnippetDrawer.vue"));
const PortForwardManager = defineAsyncComponent(() => import("./components/tunnels/PortForwardManager.vue"));
const SftpSidebar = defineAsyncComponent(() => import("./components/sftp/SftpSidebar.vue"));
const TransferQueue = defineAsyncComponent(() => import("./components/sftp/TransferQueue.vue"));
const TerminalCommandPalette = defineAsyncComponent(() => import("./components/terminal/TerminalCommandPalette.vue"));
const ShortcutsModal = defineAsyncComponent(() => import("./components/terminal/ShortcutsModal.vue"));
const RestoreSessionsModal = defineAsyncComponent(() => import("./components/terminal/RestoreSessionsModal.vue"));

const { t } = useI18n();
const vaultStore = useVaultStore();
const sessionsStore = useSessionsStore();
const settingsStore = useSettingsStore();
const tunnelsStore = useTunnelsStore();
const sftpStore = useSftpStore();
const uiStore = useUiStore();

const sessionRestore = useSessionRestore();
const isQuickConnectOpen = ref(false);
const isSettingsOpen = ref(false);
const isSnippetsOpen = ref(false);
const isTunnelsOpen = ref(false);
const isSidebarVisible = ref(true);

onMounted(async () => {
  await settingsStore.loadSettings();
  await vaultStore.checkStatus();
  window.addEventListener("keydown", handleGlobalKeyDown);
  window.addEventListener("focus", handleWindowFocus);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeyDown);
  window.removeEventListener("focus", handleWindowFocus);
});

// Abrir el Quick Connect desde otras partes de la aplicación (p. ej. una IP en la terminal).
watch(
  () => uiStore.quickConnectRequest,
  () => {
    if (vaultStore.isUnlocked) isQuickConnectOpen.value = true;
  },
);

// Al volver desde una notificación del sistema, se activa el panel que la originó.
function handleWindowFocus() {
  const target = uiStore.consumeNotified();
  if (!target) return;
  sessionsStore.activeTabId = target.tabId;
  sessionsStore.setActivePane(target.tabId, target.paneId);
}

// Atajos globales y de workspace desde el registro único (src/utils/shortcuts.ts).
function handleGlobalKeyDown(e: KeyboardEvent) {
  const def = matchShortcut(e, ["global", "workspace"]);
  if (!def) return;
  e.preventDefault();
  switch (def.id) {
    case "app.quickConnect":
      if (vaultStore.isUnlocked) isQuickConnectOpen.value = !isQuickConnectOpen.value;
      break;
    case "app.settings":
      isSettingsOpen.value = !isSettingsOpen.value;
      break;
    case "app.toggleSidebar":
      if (vaultStore.isUnlocked) isSidebarVisible.value = !isSidebarVisible.value;
      break;
    case "workspace.broadcast":
      sessionsStore.toggleBroadcastMode();
      break;
    case "app.shortcuts":
      uiStore.shortcutsOpen = !uiStore.shortcutsOpen;
      break;
    case "terminal.palette":
      if (vaultStore.isUnlocked) uiStore.paletteOpen = !uiStore.paletteOpen;
      break;
  }
}

function handleConnectHost(host: HostSummary) {
  sessionsStore.createTab(host.label, host);
}

function handleOpenLocalPty() {
  sessionsStore.createTab(t('terminal.newLocal'));
}

function handleToggleSftp() {
  if (sftpStore.isOpen) {
    sftpStore.isOpen = false;
  } else {
    // Si no hay sesión SFTP activa pero hay un tab/panel con host remoto, abrimos sftp con ese host automáticamente
    if (!sftpStore.currentSessionId && sessionsStore.activeTabId) {
      const leaves = sessionsStore.getLeafPanesInTab(sessionsStore.activeTabId);
      const activeTab = sessionsStore.tabs.find((t) => t.id === sessionsStore.activeTabId);
      const activePane = leaves.find((l) => l.id === activeTab?.activePaneId) || leaves[0];
      if (activePane?.host) {
        sftpStore.openSftp(activePane.host.id);
        return;
      }
    }
    sftpStore.isOpen = true;
  }
}

function handleConnectSftp(host: HostSummary) {
  sftpStore.openSftp(host.id);
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
        <img src="/icon.png" class="w-6 h-6 rounded-lg shadow-xs object-cover border border-theme" alt="NexusTerm Logo" />
        <span class="text-sm font-bold tracking-tight text-theme-main flex items-center space-x-1">
          <span>Nexus</span><span class="text-theme-accent">Term</span>
        </span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-sm bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono font-medium">v0.1.1</span>
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
          v-if="vaultStore.isUnlocked"
          @click="isTunnelsOpen = !isTunnelsOpen"
          title="Gestor de Túneles SSH"
          class="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-theme-muted hover:text-theme-main bg-theme-surface hover:bg-theme-active border border-theme rounded-lg transition-colors cursor-pointer relative"
        >
          <ArrowRightLeft class="w-3.5 h-3.5 text-cyan-400" />
          <span>Túneles</span>
          <span
            v-if="tunnelsStore.activeTunnelsCount > 0"
            class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5"
          ></span>
        </button>

        <button
          v-if="vaultStore.isUnlocked"
          @click="handleToggleSftp"
          title="Explorador SFTP (Archivos Remotos)"
          :class="[
            'flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer',
            sftpStore.isOpen
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-xs'
              : 'text-theme-muted hover:text-theme-main bg-theme-surface hover:bg-theme-active border-theme'
          ]"
        >
          <FolderSync class="w-3.5 h-3.5 text-amber-400" />
          <span>SFTP</span>
          <span
            v-if="sftpStore.currentSessionId"
            class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5"
          ></span>
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

        <!-- SFTP Explorer Sidebar -->
        <SftpSidebar />

        <!-- Quick Connect Palette Modal -->
        <QuickConnectModal
          :is-open="isQuickConnectOpen"
          :prefill="uiStore.quickConnectPrefill"
          @close="isQuickConnectOpen = false"
          @connect-host="handleConnectHost"
          @connect-sftp="handleConnectSftp"
          @open-sftp="handleToggleSftp"
          @open-local-pty="handleOpenLocalPty"
          @open-settings="isSettingsOpen = true"
          @open-snippets="isSnippetsOpen = true"
          @open-tunnels="isTunnelsOpen = true"
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

      <!-- Port Forwarding Manager Modal -->
      <PortForwardManager
        :is-open="isTunnelsOpen"
        @close="isTunnelsOpen = false"
      />

      <!-- SFTP Transfer Queue Drawer -->
      <TransferQueue />

      <TerminalCommandPalette v-if="uiStore.paletteOpen" @close="uiStore.paletteOpen = false" />
      <RestoreSessionsModal
        v-if="sessionRestore.pendingLayout.value && vaultStore.isUnlocked"
        :tab-count="sessionRestore.pendingTabCount()"
        @restore="sessionRestore.confirmRestore()"
        @discard="sessionRestore.discardRestore()"
      />
      <ShortcutsModal v-if="uiStore.shortcutsOpen" @close="uiStore.shortcutsOpen = false" />
    </main>
    <ToastHost />
  </div>
</template>
