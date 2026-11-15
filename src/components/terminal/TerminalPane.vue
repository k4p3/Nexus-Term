<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { sessionService } from "../../services/session.service";
import { useSessionsStore } from "../../stores/sessions.store";
import { useSettingsStore } from "../../stores/settings.store";
import { useVaultStore } from "../../stores/vault.store";
import TerminalSearchBar, { type SearchOptions } from "./TerminalSearchBar.vue";
import type { LeafPane } from "../../types/session";
import type { HostSummary } from "../../types/inventory";
import {
  Columns,
  Rows,
  X,
  Server,
  Terminal as TerminalIcon,
  Loader2,
  AlertCircle,
  Search,
  CheckCircle2,
  XCircle,
  Copy,
  ChevronUp,
  ChevronDown,
  Radio,
  FolderInput,
  ChevronRight,
} from "lucide-vue-next";

const props = defineProps<{
  pane: LeafPane;
  tabId: string;
  isActive: boolean;
}>();

const { t } = useI18n();
const sessionsStore = useSessionsStore();
const settingsStore = useSettingsStore();
const vaultStore = useVaultStore();

const terminalContainer = ref<HTMLDivElement | null>(null);
const isConnecting = ref(true);
const errorMessage = ref<string | null>(null);
const isSearchOpen = ref(false);

// Split Menu state
const isSplitMenuOpen = ref(false);
const splitDirection = ref<'horizontal' | 'vertical'>('horizontal');
const showServerPicker = ref(false);

const otherTabs = computed(() => sessionsStore.tabs.filter((t) => t.id !== props.tabId));

function openSplitMenu(direction: 'horizontal' | 'vertical') {
  if (isSplitMenuOpen.value && splitDirection.value === direction) {
    isSplitMenuOpen.value = false;
  } else {
    splitDirection.value = direction;
    isSplitMenuOpen.value = true;
    showServerPicker.value = false;
  }
}

function splitWithLocal() {
  sessionsStore.splitPane(props.tabId, props.pane.id, splitDirection.value, undefined);
  isSplitMenuOpen.value = false;
}

function splitWithDuplicate() {
  sessionsStore.splitPane(props.tabId, props.pane.id, splitDirection.value, props.pane.host);
  isSplitMenuOpen.value = false;
}

function splitWithHost(host: HostSummary) {
  sessionsStore.splitPane(props.tabId, props.pane.id, splitDirection.value, host);
  isSplitMenuOpen.value = false;
  showServerPicker.value = false;
}

function dockExistingTab(sourceTabId: string) {
  sessionsStore.dockTabIntoPane(sourceTabId, props.tabId, props.pane.id, splitDirection.value);
  isSplitMenuOpen.value = false;
}

// Shell integration (OSC 133) state
interface CommandBlock {
  promptLine: number;
  commandStartLine?: number;
  outputStartLine?: number;
  endLine?: number;
  exitCode?: number;
  startTime?: number;
  durationMs?: number;
}
const commandBlocks = ref<CommandBlock[]>([]);
const lastExitCode = ref<number | null>(null);
const lastDuration = ref<string | null>(null);
const isOutputCopied = ref(false);

let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let searchAddon: SearchAddon | null = null;
let resizeObserver: ResizeObserver | null = null;
let sessionId: string | null = null;

// Watch for live settings hot-reload
watch(
  () => [
    settingsStore.settings.font_family,
    settingsStore.settings.font_size,
    settingsStore.settings.line_height,
    settingsStore.settings.cursor_style,
    settingsStore.settings.cursor_blink,
    settingsStore.settings.theme_id,
  ],
  () => {
    if (!term) return;
    term.options.fontFamily = settingsStore.settings.font_family;
    term.options.fontSize = settingsStore.settings.font_size;
    term.options.lineHeight = settingsStore.settings.line_height;
    term.options.cursorStyle = settingsStore.settings.cursor_style;
    term.options.cursorBlink = settingsStore.settings.cursor_blink;
    term.options.theme = settingsStore.activeTheme;

    if (fitAddon) {
      fitAddon.fit();
      if (sessionId) {
        sessionService.resizeSession(sessionId, term.cols, term.rows);
      }
    }
  }
);

watch(
  () => props.isActive,
  (active) => {
    if (active && term) {
      nextTick(() => {
        fitAddon?.fit();
        term?.focus();
        if (sessionId && term) {
          sessionService.resizeSession(sessionId, term.cols, term.rows);
        }
      });
    }
  }
);

function handleSearch(query: string, options: SearchOptions, direction: 'next' | 'previous') {
  if (!searchAddon) return;
  const searchOpts = {
    regex: options.regex,
    caseSensitive: options.matchCase,
    wholeWord: options.wholeWord,
    decorations: {
      matchOverviewRuler: '#38bdf8',
      activeMatchColorOverviewRuler: '#f59e0b',
    },
  };

  if (direction === 'next') {
    searchAddon.findNext(query, searchOpts);
  } else {
    searchAddon.findPrevious(query, searchOpts);
  }
}

function handleCloseSearch() {
  isSearchOpen.value = false;
  searchAddon?.clearDecorations();
  term?.focus();
}

function jumpToPreviousPrompt() {
  if (!term || commandBlocks.value.length === 0) return;
  const currentLine = term.buffer.active.viewportY;
  const prev = [...commandBlocks.value].reverse().find((b) => b.promptLine < currentLine - 1);
  if (prev) {
    term.scrollToLine(prev.promptLine);
  } else {
    term.scrollToLine(commandBlocks.value[0].promptLine);
  }
}

function jumpToNextPrompt() {
  if (!term || commandBlocks.value.length === 0) return;
  const currentLine = term.buffer.active.viewportY;
  const next = commandBlocks.value.find((b) => b.promptLine > currentLine + 1);
  if (next) {
    term.scrollToLine(next.promptLine);
  } else {
    term.scrollToBottom();
  }
}

function copyLastOutput() {
  if (!term || commandBlocks.value.length === 0) return;
  const last = commandBlocks.value[commandBlocks.value.length - 1];
  const start = last.outputStartLine ?? last.promptLine;
  const end = last.endLine ?? (term.buffer.active.baseY + term.buffer.active.cursorY);

  let text = '';
  for (let l = start; l <= end; l++) {
    const line = term.buffer.active.getLine(l);
    if (line) text += line.translateToString(true) + '\n';
  }

  const clean = text.trim();
  if (clean) {
    navigator.clipboard.writeText(clean);
    isOutputCopied.value = true;
    setTimeout(() => {
      isOutputCopied.value = false;
    }, 2000);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    isSearchOpen.value = !isSearchOpen.value;
  } else if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    const k = e.key.toLowerCase();
    if (k === 'arrowup') {
      e.preventDefault();
      jumpToPreviousPrompt();
    } else if (k === 'arrowdown') {
      e.preventDefault();
      jumpToNextPrompt();
    } else if (k === 'o' || k === 'd') {
      e.preventDefault();
      sessionsStore.splitPane(props.tabId, props.pane.id, 'horizontal', props.pane.host);
    } else if (k === 'e') {
      e.preventDefault();
      sessionsStore.splitPane(props.tabId, props.pane.id, 'vertical', props.pane.host);
    } else if (k === 'w') {
      e.preventDefault();
      handleClose();
    }
  }
}

onMounted(async () => {
  if (!terminalContainer.value) return;

  // Initialize xterm with user settings
  term = new Terminal({
    cursorBlink: settingsStore.settings.cursor_blink,
    cursorStyle: settingsStore.settings.cursor_style,
    allowProposedApi: true,
    fontFamily: settingsStore.settings.font_family,
    fontSize: settingsStore.settings.font_size,
    lineHeight: settingsStore.settings.line_height,
    allowTransparency: true,
    theme: settingsStore.activeTheme,
  });

  fitAddon = new FitAddon();
  searchAddon = new SearchAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(searchAddon);
  term.loadAddon(new WebLinksAddon());

  // Register OSC 133 Shell Integration Parser
  term.parser.registerOscHandler(133, (data) => {
    const parts = data.split(';');
    const action = parts[0];
    const curY = (term?.buffer.active.baseY || 0) + (term?.buffer.active.cursorY || 0);

    if (action === 'A') {
      // Prompt start
      commandBlocks.value.push({
        promptLine: curY,
        startTime: Date.now(),
      });
    } else if (action === 'B') {
      // Command input start
      const last = commandBlocks.value[commandBlocks.value.length - 1];
      if (last) last.commandStartLine = curY;
    } else if (action === 'C') {
      // Command output start
      const last = commandBlocks.value[commandBlocks.value.length - 1];
      if (last) {
        last.outputStartLine = curY;
        last.startTime = Date.now();
      }
    } else if (action === 'D') {
      // Command finished with exit code
      const last = commandBlocks.value[commandBlocks.value.length - 1];
      const code = parts[1] !== undefined ? parseInt(parts[1], 10) : 0;
      if (last) {
        last.endLine = curY;
        last.exitCode = code;
        if (last.startTime) {
          last.durationMs = Date.now() - last.startTime;
        }
      }
      lastExitCode.value = code;
      if (last?.durationMs) {
        lastDuration.value = (last.durationMs / 1000).toFixed(1) + 's';
      }
    }
    return true;
  });

  term.open(terminalContainer.value);

  // Keyboard shortcuts intercepted before sending to shell
  term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
    if (e.type === 'keydown') {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        isSearchOpen.value = !isSearchOpen.value;
        return false;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'b') {
        return false;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 'arrowup') {
          jumpToPreviousPrompt();
          return false;
        }
        if (k === 'arrowdown') {
          jumpToNextPrompt();
          return false;
        }
        if (k === 'o' || k === 'd') {
          sessionsStore.splitPane(props.tabId, props.pane.id, 'horizontal', props.pane.host);
          return false;
        }
        if (k === 'e') {
          sessionsStore.splitPane(props.tabId, props.pane.id, 'vertical', props.pane.host);
          return false;
        }
        if (k === 'w') {
          handleClose();
          return false;
        }
        if (k === 'b') {
          sessionsStore.toggleBroadcastMode();
          return false;
        }
      }
    }
    return true;
  });

  // Try loading WebGL addon with canvas fallback
  try {
    const webgl = new WebglAddon();
    term.loadAddon(webgl);
  } catch (e) {
    console.warn("WebGL addon unavailable, using default canvas renderer", e);
  }

  fitAddon.fit();

  // Send keystrokes to Rust backend and replicate if broadcast mode is active
  term.onData((data) => {
    if (sessionId) {
      const bytes = new TextEncoder().encode(data);
      sessionService.writeSession(sessionId, bytes);
      if (sessionsStore.isBroadcastMode) {
        sessionsStore.broadcastData(props.pane.id, props.tabId, bytes);
      }
    }
  });

  // Connect to Local PTY or SSH
  try {
    isConnecting.value = true;
    errorMessage.value = null;

    if (props.pane.hostId) {
      sessionId = await sessionService.connectSsh(
        props.pane.hostId,
        term.cols,
        term.rows,
        (chunk) => {
          term?.write(chunk);
        }
      );
    } else {
      sessionId = await sessionService.openLocalPty(
        term.cols,
        term.rows,
        (chunk) => {
          term?.write(chunk);
        },
        settingsStore.settings.default_shell
      );
    }
    if (sessionId) {
      sessionsStore.registerPaneSession(props.pane.id, sessionId);
    }
    isConnecting.value = false;
  } catch (err: any) {
    isConnecting.value = false;
    errorMessage.value = typeof err === "string" ? err : err?.message || "Error al conectar la sesión.";
  }

  // Handle container resizing
  resizeObserver = new ResizeObserver(() => {
    if (fitAddon && term) {
      fitAddon.fit();
      if (sessionId) {
        sessionService.resizeSession(sessionId, term.cols, term.rows);
      }
    }
  });
  resizeObserver.observe(terminalContainer.value);

  terminalContainer.value.addEventListener('keydown', handleKeyDown);
  term.focus();
});

onBeforeUnmount(async () => {
  if (terminalContainer.value) {
    terminalContainer.value.removeEventListener('keydown', handleKeyDown);
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (sessionId) {
    sessionsStore.unregisterPaneSession(props.pane.id);
    await sessionService.closeSession(sessionId);
    sessionId = null;
  }
  if (term) {
    term.dispose();
    term = null;
  }
});

function handlePaneClick() {
  sessionsStore.setActivePane(props.tabId, props.pane.id);
  term?.focus();
}

function handleSplitHorizontal() {
  sessionsStore.splitPane(props.tabId, props.pane.id, "horizontal", props.pane.host);
}

function handleSplitVertical() {
  sessionsStore.splitPane(props.tabId, props.pane.id, "vertical", props.pane.host);
}

function handleClose() {
  sessionsStore.closePane(props.tabId, props.pane.id);
}
</script>

<template>
  <div
    @click="handlePaneClick"
    class="flex-1 flex flex-col h-full w-full bg-theme-app overflow-hidden relative border transition-colors"
    :class="[
      sessionsStore.isBroadcastMode
        ? 'border-amber-500/60 ring-1 ring-amber-500/40'
        : isActive
        ? 'border-theme-accent shadow-xs'
        : 'border-theme',
    ]"
  >
    <!-- Pane Mini Header -->
    <div
      class="h-7 border-b flex items-center justify-between px-2.5 text-xs select-none shrink-0"
      :class="sessionsStore.isBroadcastMode ? 'bg-amber-950/30 border-amber-800/60' : 'bg-theme-header border-theme'"
    >
      <div class="flex items-center space-x-2 truncate">
        <Server v-if="pane.hostId" class="w-3.5 h-3.5 text-theme-accent shrink-0" />
        <TerminalIcon v-else class="w-3.5 h-3.5 text-purple-400 shrink-0" />
        <span class="text-[11px] font-medium text-theme-main truncate">{{ pane.title }}</span>

        <!-- Broadcast Indicator -->
        <span
          v-if="sessionsStore.isBroadcastMode"
          class="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded"
        >
          <Radio class="w-2.5 h-2.5 animate-pulse text-amber-400" />
          <span>BROADCAST</span>
        </span>

        <!-- Shell Integration Status Badge -->
        <div
          v-if="lastExitCode !== null"
          class="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800"
          :title="`Último comando: Salida ${lastExitCode} (${lastDuration || '0s'})`"
        >
          <CheckCircle2 v-if="lastExitCode === 0" class="w-3 h-3 text-emerald-400" />
          <XCircle v-else class="w-3 h-3 text-rose-400" />
          <span :class="lastExitCode === 0 ? 'text-emerald-300' : 'text-rose-300'">
            {{ lastExitCode }}
          </span>
          <span v-if="lastDuration" class="text-slate-500 text-[9px]">
            {{ lastDuration }}
          </span>
        </div>
      </div>

      <div class="flex items-center space-x-1">
        <!-- Copy Output button -->
        <button
          v-if="commandBlocks.length > 0"
          @click.stop="copyLastOutput"
          :title="isOutputCopied ? '¡Copiado!' : 'Copiar Salida del Último Comando'"
          class="p-1 text-slate-400 hover:text-cyan-300 rounded-sm hover:bg-slate-800 transition-colors"
        >
          <Copy class="w-3 h-3" :class="isOutputCopied ? 'text-emerald-400' : ''" />
        </button>

        <!-- Search button -->
        <button
          @click.stop="isSearchOpen = !isSearchOpen"
          title="Buscar en buffer (Ctrl+F)"
          class="p-1 text-slate-400 hover:text-white rounded-sm hover:bg-slate-800 transition-colors"
        >
          <Search class="w-3 h-3" />
        </button>

        <!-- Prompt navigation buttons -->
        <button
          v-if="commandBlocks.length > 0"
          @click.stop="jumpToPreviousPrompt"
          title="Comando Anterior (Ctrl+Shift+↑)"
          class="p-1 text-slate-400 hover:text-white rounded-sm hover:bg-slate-800 transition-colors"
        >
          <ChevronUp class="w-3 h-3" />
        </button>
        <button
          v-if="commandBlocks.length > 0"
          @click.stop="jumpToNextPrompt"
          title="Comando Siguiente (Ctrl+Shift+↓)"
          class="p-1 text-slate-400 hover:text-white rounded-sm hover:bg-slate-800 transition-colors"
        >
          <ChevronDown class="w-3 h-3" />
        </button>

        <button
          @click.stop="openSplitMenu('horizontal')"
          :title="`${t('terminal.splitRight')} (Ctrl+Shift+O / Ctrl+Shift+D)`"
          class="p-1 text-slate-400 hover:text-white rounded-sm hover:bg-slate-800 transition-colors"
          :class="isSplitMenuOpen && splitDirection === 'horizontal' ? 'bg-cyan-500/20 text-cyan-300' : ''"
        >
          <Columns class="w-3 h-3" />
        </button>
        <button
          @click.stop="openSplitMenu('vertical')"
          :title="`${t('terminal.splitDown')} (Ctrl+Shift+E)`"
          class="p-1 text-slate-400 hover:text-white rounded-sm hover:bg-slate-800 transition-colors"
          :class="isSplitMenuOpen && splitDirection === 'vertical' ? 'bg-cyan-500/20 text-cyan-300' : ''"
        >
          <Rows class="w-3 h-3" />
        </button>
        <button
          @click.stop="handleClose"
          :title="`${t('terminal.closePane')} (Ctrl+Shift+W)`"
          class="p-1 text-slate-400 hover:text-red-400 rounded-sm hover:bg-slate-800 transition-colors"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Split Contextual Menu Popover -->
    <div
      v-if="isSplitMenuOpen"
      @click.stop
      class="absolute right-2 top-8 z-40 w-64 bg-theme-surface border border-theme rounded-xl shadow-2xl p-2.5 space-y-2 text-xs select-none backdrop-blur-md"
    >
      <div class="flex items-center justify-between pb-1.5 border-b border-theme">
        <span class="font-semibold text-theme-main">Dividir Panel</span>
        <div class="flex items-center gap-1 bg-theme-app p-0.5 rounded-lg border border-theme">
          <button
            type="button"
            @click.stop="splitDirection = 'horizontal'"
            :class="['p-1 rounded transition-colors', splitDirection === 'horizontal' ? 'bg-theme-active text-theme-accent font-bold' : 'text-theme-muted']"
            title="Horizontal"
          >
            <Columns class="w-3 h-3" />
          </button>
          <button
            type="button"
            @click.stop="splitDirection = 'vertical'"
            :class="['p-1 rounded transition-colors', splitDirection === 'vertical' ? 'bg-theme-active text-theme-accent font-bold' : 'text-theme-muted']"
            title="Vertical"
          >
            <Rows class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- Quick targets -->
      <div class="space-y-1">
        <button
          type="button"
          @click.stop="splitWithLocal"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 text-left transition-colors cursor-pointer"
        >
          <TerminalIcon class="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>Nueva Terminal Local</span>
        </button>

        <button
          v-if="pane.host"
          type="button"
          @click.stop="splitWithDuplicate"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 text-left transition-colors cursor-pointer"
        >
          <Server class="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span class="truncate">Mismo Servidor ({{ pane.host.label }})</span>
        </button>

        <button
          type="button"
          @click.stop="showServerPicker = !showServerPicker"
          class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 text-left transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2 truncate">
            <Server class="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Elegir Servidor...</span>
          </div>
          <ChevronRight class="w-3 h-3 text-neutral-500" :class="showServerPicker ? 'rotate-90' : ''" />
        </button>

        <!-- Sublist of saved hosts -->
        <div v-if="showServerPicker" class="pl-4 max-h-28 overflow-y-auto space-y-0.5 border-l border-neutral-800 ml-2">
          <button
            v-for="h in vaultStore.hosts"
            :key="h.id"
            type="button"
            @click.stop="splitWithHost(h)"
            class="w-full flex items-center gap-1.5 px-2 py-1 rounded text-neutral-300 hover:text-white hover:bg-neutral-800 text-left truncate text-[11px] transition-colors"
          >
            <span class="truncate">{{ h.label }}</span>
          </button>
          <div v-if="vaultStore.hosts.length === 0" class="text-[10px] text-neutral-500 py-1">
            Sin servidores guardados
          </div>
        </div>
      </div>

      <!-- Dock existing open tab into this split -->
      <div v-if="otherTabs.length > 0" class="pt-1.5 border-t border-neutral-800">
        <div class="text-[10px] uppercase font-semibold text-neutral-400 px-1 mb-1">
          Mover pestaña aquí:
        </div>
        <div class="max-h-28 overflow-y-auto space-y-0.5">
          <button
            v-for="ot in otherTabs"
            :key="ot.id"
            type="button"
            @click.stop="dockExistingTab(ot.id)"
            class="w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-neutral-300 hover:text-white hover:bg-neutral-800 text-left truncate transition-colors text-[11px] cursor-pointer"
          >
            <FolderInput class="w-3 h-3 text-amber-400 shrink-0" />
            <span class="truncate">{{ ot.title }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Terminal Element Container -->
    <div class="flex-1 w-full h-full p-1 relative overflow-hidden bg-slate-950">
      <div v-show="!errorMessage" ref="terminalContainer" class="w-full h-full"></div>

      <!-- Search Bar Component -->
      <TerminalSearchBar
        :is-open="isSearchOpen"
        @close="handleCloseSearch"
        @search="handleSearch"
      />

      <!-- Connecting Spinner -->
      <div v-if="isConnecting" class="absolute inset-0 bg-slate-950/80 flex items-center justify-center space-x-2 text-xs text-slate-400">
        <Loader2 class="w-4 h-4 animate-spin text-cyan-400" />
        <span>Conectando sesión...</span>
      </div>

      <!-- Error State -->
      <div v-if="errorMessage" class="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center">
        <AlertCircle class="w-8 h-8 text-red-400 mb-2" />
        <h4 class="text-sm font-bold text-white mb-1">Error de Conexión</h4>
        <p class="text-xs text-slate-400 max-w-sm mb-4">{{ errorMessage }}</p>
        <button
          @click="handleClose"
          class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white rounded-lg transition"
        >
          Cerrar Panel
        </button>
      </div>
    </div>
  </div>
</template>
