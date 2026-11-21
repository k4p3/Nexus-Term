<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";
import { useVaultStore } from "./stores/vault.store";
import { useSessionsStore } from "./stores/sessions.store";
import { useSettingsStore } from "./stores/settings.store";
import { useTunnelsStore } from "./stores/tunnels.store";
import { useSftpStore } from "./stores/sftp.store";
import { useEnsureUnlocked } from "./composables/useEnsureUnlocked";
import { useIdleLock } from "./composables/useIdleLock";
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
const VaultUnlockModal = defineAsyncComponent(() => import("./components/vault/VaultUnlockModal.vue"));
const RestoreSessionsBanner = defineAsyncComponent(() => import("./components/terminal/RestoreSessionsBanner.vue"));
const RestoreSessionsModal = defineAsyncComponent(() => import("./components/terminal/RestoreSessionsModal.vue"));

const { t } = useI18n();
const vaultStore = useVaultStore();
const sessionsStore = useSessionsStore();
const settingsStore = useSettingsStore();
const tunnelsStore = useTunnelsStore();
const sftpStore = useSftpStore();
const uiStore = useUiStore();

const sessionRestore = useSessionRestore();
const { ensureUnlocked, runWithUnlock, promptOpen } = useEnsureUnlocked();
useIdleLock();
// Hasta cargar ajustes y estado de la bóveda no se pinta el workspace (evita parpadeos).
const appReady = ref(false);
// Con "pedir contraseña al iniciar" se muestra la pantalla completa hasta el primer desbloqueo.
const unlockedOnce = ref(false);
const showStartupGate = computed(
  () => appReady.value && settingsStore.settings.ask_password_on_startup && !unlockedOnce.value && !vaultStore.isUnlocked,
);
watch(() => vaultStore.isUnlocked, (u) => { if (u) unlockedOnce.value = true; }, { immediate: true });
const isQuickConnectOpen = ref(false);
const isSettingsOpen = ref(false);
const isSnippetsOpen = ref(false);
const isTunnelsOpen = ref(false);
const isSidebarVisible = ref(true);

onMounted(async () => {
  await settingsStore.loadSettings();
  await vaultStore.checkStatus();
  appReady.value = true;
  await sessionRestore.startup();
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
    isQuickConnectOpen.value = true;
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
      isQuickConnectOpen.value = !isQuickConnectOpen.value;
      break;
    case "app.settings":
      isSettingsOpen.value = !isSettingsOpen.value;
      break;
    case "app.toggleSidebar":
      isSidebarVisible.value = !isSidebarVisible.value;
      break;
    case "workspace.broadcast":
      sessionsStore.toggleBroadcastMode();
      break;
    case "app.shortcuts":
      uiStore.shortcutsOpen = !uiStore.shortcutsOpen;
      break;
    case "terminal.palette":
      uiStore.paletteOpen = !uiStore.paletteOpen;
      break;
  }
}

function handleConnectHost(host: HostSummary) {
  sessionsStore.createTab(host.label, host);
}

function handleOpenLocalPty() {
  sessionsStore.createTab(t('terminal.newLocal'));
}

async function handleToggleSftp() {
  if (sftpStore.isOpen) {
    sftpStore.isOpen = false;
  } else {
    // Si no hay sesión SFTP activa pero hay un tab/panel con host remoto, abrimos sftp con ese host automáticamente
    if (!sftpStore.currentSessionId && sessionsStore.activeTabId) {
      const leaves = sessionsStore.getLeafPanesInTab(sessionsStore.activeTabId);
      const activeTab = sessionsStore.tabs.find((t) => t.id === sessionsStore.activeTabId);
      const activePane = leaves.find((l) => l.id === activeTab?.activePaneId) || leaves[0];
      if (activePane?.host) {
        const hostId = activePane.host.id;
        await runWithUnlock(() => sftpStore.openSftp(hostId));
        return;
      }
    }
    sftpStore.isOpen = true;
  }
}

function handleConnectSftp(host: HostSummary) {
  void runWithUnlock(() => sftpStore.openSftp(host.id));
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
  <div class="h-full w-full flex flex-col bg-app text-fg select-none">
    <!-- Top Application Bar -->
    <header class="h-11 bg-header border-b border-line flex items-center px-3 justify-between select-none shrink-0 z-20">
      <div class="flex items-center gap-2.5">
        <img src="/icon.png" class="w-6 h-6 rounded-control object-cover" alt="" />
        <span class="text-sm font-semibold tracking-tight text-fg">NexusTerm</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-control bg-active text-fg-muted font-mono">v0.2.0</span>
      </div>

      <div class="flex items-center gap-1">
        <button
          @click="isQuickConnectOpen = true"
          :title="t('hosts.quickConnect')"
          class="inline-flex items-center gap-2 h-7 pl-2.5 pr-1.5 mr-2 min-w-48 text-xs text-fg-muted hover:text-fg bg-app hover:border-accent/50 border border-line rounded-control transition-colors cursor-pointer"
        >
          <Search class="w-3.5 h-3.5" />
          <span class="flex-1 text-left">{{ t('common.search') }}</span>
          <kbd class="text-[10px] font-mono bg-header px-1.5 rounded-control border border-line">Ctrl+K</kbd>
        </button>

        <button
          @click="isSnippetsOpen = !isSnippetsOpen"
          :title="t('ui.app.snippetsTitle')"
          :aria-pressed="isSnippetsOpen"
          class="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs rounded-control transition-colors cursor-pointer"
          :class="isSnippetsOpen ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg hover:bg-active'"
        >
          <Code class="w-3.5 h-3.5" />
          <span>Snippets</span>
        </button>

        <button
          @click="isTunnelsOpen = !isTunnelsOpen"
          :title="t('ui.app.tunnelsTitle')"
          :aria-pressed="isTunnelsOpen"
          class="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs rounded-control transition-colors cursor-pointer"
          :class="isTunnelsOpen ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg hover:bg-active'"
        >
          <ArrowRightLeft class="w-3.5 h-3.5" />
          <span>{{ t('ui.app.tunnels') }}</span>
          <span v-if="tunnelsStore.activeTunnelsCount > 0" class="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true"></span>
        </button>

        <button
          @click="handleToggleSftp"
          :title="t('ui.app.sftpTitle')"
          :aria-pressed="sftpStore.isOpen"
          class="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs rounded-control transition-colors cursor-pointer"
          :class="sftpStore.isOpen ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg hover:bg-active'"
        >
          <FolderSync class="w-3.5 h-3.5" />
          <span>SFTP</span>
          <span v-if="sftpStore.currentSessionId" class="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true"></span>
        </button>

        <span class="w-px h-5 bg-line mx-1.5" aria-hidden="true"></span>

        <button
          @click="isSettingsOpen = true"
          :title="t('settings.title')"
          :aria-label="t('settings.title')"
          class="w-7 h-7 inline-flex items-center justify-center text-fg-muted hover:text-fg hover:bg-active rounded-control transition-colors cursor-pointer"
        >
          <Settings class="w-4 h-4" />
        </button>

        <button
          v-if="vaultStore.isUnlocked"
          @click="vaultStore.lock()"
          :title="t('vault.lockVault')"
          class="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs rounded-control transition-colors cursor-pointer text-fg-muted hover:text-fg hover:bg-active"
        >
          <Lock class="w-3.5 h-3.5 text-success" />
          <span>{{ t('vault.lockVault') }}</span>
        </button>
        <button
          v-else
          @click="ensureUnlocked()"
          :title="t('vault.unlock')"
          class="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs rounded-control transition-colors cursor-pointer text-warning bg-warning/10 hover:bg-warning/20"
        >
          <Lock class="w-3.5 h-3.5" />
          <span>{{ t('vault.unlock') }}</span>
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 overflow-hidden relative flex">
      <div v-if="!appReady" class="h-full w-full flex items-center justify-center">
        <RefreshCw class="w-6 h-6 text-accent animate-spin" />
      </div>

      <VaultUnlockScreen v-else-if="showStartupGate" />

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
        v-if="sessionRestore.pendingLayout.value && !sessionRestore.pendingInline.value"
        :tab-count="sessionRestore.pendingTabCount()"
        @restore="sessionRestore.confirmRestore()"
        @discard="sessionRestore.discardRestore()"
      />
      <RestoreSessionsBanner
        v-if="sessionRestore.pendingLayout.value && sessionRestore.pendingInline.value"
        :tab-count="sessionRestore.pendingTabCount()"
        @restore="sessionRestore.confirmRestore()"
        @discard="sessionRestore.discardRestore()"
      />
      <VaultUnlockModal v-if="promptOpen" />
      <ShortcutsModal v-if="uiStore.shortcutsOpen" @close="uiStore.shortcutsOpen = false" />
    </main>
    <ToastHost />
  </div>
</template>
