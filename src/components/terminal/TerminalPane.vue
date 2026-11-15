<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { sessionService } from "../../services/session.service";
import { useSessionsStore } from "../../stores/sessions.store";
import { useSettingsStore } from "../../stores/settings.store";
import type { LeafPane } from "../../types/session";
import {
  Columns,
  Rows,
  X,
  Server,
  Terminal as TerminalIcon,
  Loader2,
  AlertCircle,
} from "lucide-vue-next";

const props = defineProps<{
  pane: LeafPane;
  tabId: string;
  isActive: boolean;
}>();

const { t } = useI18n();
const sessionsStore = useSessionsStore();
const settingsStore = useSettingsStore();

const terminalContainer = ref<HTMLDivElement | null>(null);
const isConnecting = ref(true);
const errorMessage = ref<string | null>(null);

let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
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
  term.loadAddon(fitAddon);
  term.loadAddon(new SearchAddon());
  term.loadAddon(new WebLinksAddon());

  term.open(terminalContainer.value);

  // Try loading WebGL addon with canvas fallback
  try {
    const webgl = new WebglAddon();
    term.loadAddon(webgl);
  } catch (e) {
    console.warn("WebGL addon unavailable, using default canvas renderer", e);
  }

  fitAddon.fit();

  // Send keystrokes to Rust backend
  term.onData((data) => {
    if (sessionId) {
      sessionService.writeSession(sessionId, new TextEncoder().encode(data));
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

  term.focus();
});

onBeforeUnmount(async () => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (sessionId) {
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
    class="flex-1 flex flex-col h-full w-full bg-slate-950 overflow-hidden relative border"
    :class="isActive ? 'border-cyan-500/40 shadow-xs' : 'border-slate-800/80'"
  >
    <!-- Pane Mini Header -->
    <div class="h-6 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between px-2.5 text-xs select-none shrink-0">
      <div class="flex items-center space-x-1.5 truncate">
        <Server v-if="pane.hostId" class="w-3 h-3 text-cyan-400 shrink-0" />
        <TerminalIcon v-else class="w-3 h-3 text-purple-400 shrink-0" />
        <span class="text-[11px] font-medium text-slate-300 truncate">{{ pane.title }}</span>
      </div>

      <div class="flex items-center space-x-1">
        <button
          @click.stop="handleSplitHorizontal"
          :title="t('terminal.splitRight')"
          class="p-0.5 text-slate-400 hover:text-white rounded-sm hover:bg-slate-800 transition-colors"
        >
          <Columns class="w-3 h-3" />
        </button>
        <button
          @click.stop="handleSplitVertical"
          :title="t('terminal.splitDown')"
          class="p-0.5 text-slate-400 hover:text-white rounded-sm hover:bg-slate-800 transition-colors"
        >
          <Rows class="w-3 h-3" />
        </button>
        <button
          @click.stop="handleClose"
          :title="t('terminal.closePane')"
          class="p-0.5 text-slate-400 hover:text-red-400 rounded-sm hover:bg-slate-800 transition-colors"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Terminal Element Container -->
    <div class="flex-1 w-full h-full p-1 relative overflow-hidden bg-slate-950">
      <div v-show="!errorMessage" ref="terminalContainer" class="w-full h-full"></div>

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
