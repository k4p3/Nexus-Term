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
import { useTelemetryStore } from "../../stores/telemetry.store";
import TerminalSearchBar, { type SearchOptions } from "./TerminalSearchBar.vue";
import PasteConfirmModal from "./PasteConfirmModal.vue";
import PasteHistoryPicker from "./PasteHistoryPicker.vue";
import QuickSelectOverlay from "./QuickSelectOverlay.vue";
import TerminalLinkMenu, { type LinkMenuItem } from "./TerminalLinkMenu.vue";
import { useUiStore } from "../../stores/ui.store";
import { usePasteHistoryStore } from "../../stores/paste-history.store";
import { useSftpStore } from "../../stores/sftp.store";
import { useQuickSelect } from "../../composables/useQuickSelect";
import { matchShortcut } from "../../utils/shortcuts";
import { analyzePaste, toSingleLine, type PasteAnalysis } from "../../utils/paste-guard";
import { findIpLinks, findPathLinks, dirname } from "../../utils/link-detect";
import { buildNotificationBody, shouldNotify } from "../../utils/notify";
import TelemetryBar from "./TelemetryBar.vue";
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
  Activity,
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
const telemetryStore = useTelemetryStore();
const uiStore = useUiStore();
const pasteHistory = usePasteHistoryStore();
const sftpStore = useSftpStore();

// Pegado seguro, historial de pegado y menú de enlaces
const pendingPaste = ref<{ text: string; analysis: PasteAnalysis } | null>(null);
const isPasteHistoryOpen = ref(false);
const linkMenu = ref<{ x: number; y: number; kind: "path" | "ip"; value: string } | null>(null);

const quickSelect = useQuickSelect(
  () => term,
  () => terminalContainer.value?.parentElement ?? null,
  async (r) => {
    if (r.paste) {
      term?.paste(r.text);
      term?.focus();
    } else {
      await copyToClipboard(r.text);
    }
  },
  () => uiStore.pushToast(t("quickSelect.none")),
);

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    uiStore.pushToast(t("quickSelect.copied", { text: text.length > 40 ? text.slice(0, 37) + "…" : text }), { kind: "success" });
  } catch {
    uiStore.pushToast(t("quickSelect.copyFailed"), { kind: "warning" });
  }
}

function doPaste(text: string) {
  pasteHistory.add(text, settingsStore.settings.paste_history_size);
  term?.paste(text);
  term?.focus();
}

/** Todo pegado pasa por aquí: avisa si es multilínea, peligroso o contiene caracteres ocultos. */
function requestPaste(text: string) {
  if (!text) return;
  const analysis = analyzePaste(text);
  if (settingsStore.settings.paste_warning && analysis.needsConfirm) {
    pendingPaste.value = { text, analysis };
    return;
  }
  doPaste(text);
}

function onPasteEvent(e: ClipboardEvent) {
  const text = e.clipboardData?.getData("text/plain") ?? "";
  if (!text) return;
  e.preventDefault();
  e.stopPropagation();
  requestPaste(text);
}

function confirmPaste(singleLine = false) {
  const p = pendingPaste.value;
  pendingPaste.value = null;
  if (p) doPaste(singleLine ? toSingleLine(p.text) : p.text);
}

function cancelPaste() {
  pendingPaste.value = null;
  term?.focus();
}

function onPasteFromHistory(text: string) {
  isPasteHistoryOpen.value = false;
  requestPaste(text);
}

const linkMenuItems = computed<LinkMenuItem[]>(() => {
  const m = linkMenu.value;
  if (!m) return [];
  if (m.kind === "ip") {
    return [
      { id: "connect", label: t("links.connectSsh", { ip: m.value }) },
      { id: "copy", label: t("links.copyIp") },
    ];
  }
  const items: LinkMenuItem[] = [{ id: "copy", label: t("links.copyPath") }];
  if (props.pane.hostId) items.push({ id: "sftp", label: t("links.showInSftp") });
  return items;
});

async function onLinkAction(id: string) {
  const m = linkMenu.value;
  linkMenu.value = null;
  if (!m) return;
  if (id === "copy") await copyToClipboard(m.value);
  else if (id === "connect") uiStore.openQuickConnect(m.value);
  else if (id === "sftp" && props.pane.hostId) {
    try {
      await sftpStore.openSftp(props.pane.hostId);
      await sftpStore.navigateTo(dirname(m.value));
    } catch (e) {
      uiStore.pushToast(String(e), { kind: "warning" });
    }
  }
}

function openLinkMenu(ev: MouseEvent, kind: "path" | "ip", value: string) {
  if (!(ev.ctrlKey || ev.metaKey)) return; // sin modificador: solo seleccionar texto
  linkMenu.value = { x: ev.clientX, y: ev.clientY, kind, value };
}

async function notifyCommandFinished(code: number, durationMs: number) {
  const channel = shouldNotify({
    enabled: settingsStore.settings.notify_long_commands,
    thresholdSeconds: settingsStore.settings.notify_threshold_seconds,
    durationMs,
    windowFocused: document.hasFocus(),
    paneVisible: props.isActive && sessionsStore.activeTabId === props.tabId,
  });
  if (channel === "none") return;
  const { title, body } = buildNotificationBody({
    ok: code === 0,
    hostLabel: props.pane.title,
    durationMs,
    command: undefined, // el texto del comando solo estará disponible con el historial (cambio avanzado)
    includeCommand: settingsStore.settings.notify_include_command,
  });
  if (channel === "desktop") {
    try {
      const n = await import("@tauri-apps/plugin-notification");
      let granted = await n.isPermissionGranted();
      if (!granted) granted = (await n.requestPermission()) === "granted";
      if (granted) {
        n.sendNotification({ title, body });
        uiStore.markNotified(props.tabId, props.pane.id);
        return;
      }
    } catch {
      /* sin servicio de notificaciones: se degrada al aviso interno */
    }
  }
  uiStore.pushToast(`${title}\n${body}`, {
    kind: code === 0 ? "success" : "warning",
    tabId: props.tabId,
    paneId: props.pane.id,
  });
}

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
        notifyCommandFinished(code, last.durationMs);
      }
    }
    return true;
  });

  term.open(terminalContainer.value);

  // Atajos del registro único (src/utils/shortcuts.ts). Los de contexto global/workspace los
  // procesa App.vue; aquí solo se evita que lleguen al shell.
  term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
    if (quickSelect.active.value) {
      quickSelect.handleKey(e);
      return false;
    }
    if (e.type !== 'keydown') return true;
    const def = matchShortcut(e);
    if (!def) return true;
    if (def.context !== 'terminal') return false;
    e.preventDefault();
    const action: Record<string, () => void> = {
      'terminal.search': () => (isSearchOpen.value = !isSearchOpen.value),
      'terminal.splitH': handleSplitHorizontal,
      'terminal.splitHAlt': handleSplitHorizontal,
      'terminal.splitV': handleSplitVertical,
      'terminal.closePane': handleClose,
      'terminal.prevPrompt': jumpToPreviousPrompt,
      'terminal.nextPrompt': jumpToNextPrompt,
      'terminal.quickSelect': () => quickSelect.start(),
      'terminal.pasteHistory': () => (isPasteHistoryOpen.value = true),
    };
    action[def.id]?.();
    return false;
  });

  // Enlaces inteligentes: rutas (ruta:línea:col) e IPs. Solo se activan con Ctrl/Cmd+clic.
  term.registerLinkProvider({
    provideLinks(y, callback) {
      const text = term?.buffer.active.getLine(y - 1)?.translateToString(true);
      if (!text) return callback(undefined);
      const links = [
        ...findPathLinks(text).map((l) => ({
          range: { start: { x: l.start + 1, y }, end: { x: l.end, y } },
          text: l.text,
          activate: (ev: MouseEvent) => openLinkMenu(ev, 'path', l.path),
        })),
        ...findIpLinks(text).map((l) => ({
          range: { start: { x: l.start + 1, y }, end: { x: l.end, y } },
          text: l.ip,
          activate: (ev: MouseEvent) => openLinkMenu(ev, 'ip', l.ip),
        })),
      ];
      callback(links.length ? links : undefined);
    },
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

  terminalContainer.value.addEventListener('paste', onPasteEvent, true);
  uiStore.registerPaneActions(props.pane.id, {
    search: () => (isSearchOpen.value = !isSearchOpen.value),
    quickSelect: () => quickSelect.start(),
    pasteHistory: () => (isPasteHistoryOpen.value = true),
    prevPrompt: jumpToPreviousPrompt,
    nextPrompt: jumpToNextPrompt,
    splitH: handleSplitHorizontal,
    splitV: handleSplitVertical,
    closePane: handleClose,
    copyLastOutput,
  });
  term.focus();
});

onBeforeUnmount(async () => {
  if (terminalContainer.value) {
    terminalContainer.value.removeEventListener('paste', onPasteEvent, true);
  }
  uiStore.unregisterPaneActions(props.pane.id);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (sessionId) {
    sessionsStore.unregisterPaneSession(props.pane.id);
    await sessionService.closeSession(sessionId);
    sessionId = null;
  }
  if (props.pane.hostId) {
    telemetryStore.stopMonitoring(props.pane.hostId);
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

        <!-- Telemetry toggle button (SSH hosts only) -->
        <button
          v-if="pane.hostId"
          @click.stop="telemetryStore.togglePaneTelemetry(pane.id, pane.hostId)"
          :title="telemetryStore.isTelemetryVisible[pane.id] ? 'Ocultar monitor de telemetría' : 'Mostrar monitor de telemetría (CPU, RAM, Red)'"
          class="p-1 rounded-sm transition-colors cursor-pointer"
          :class="telemetryStore.isTelemetryVisible[pane.id] ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'"
        >
          <Activity class="w-3 h-3" />
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

    <!-- Live Telemetry Bar -->
    <TelemetryBar
      v-if="pane.hostId && telemetryStore.isTelemetryVisible[pane.id]"
      :host-id="pane.hostId"
      :pane-id="pane.id"
      @close="telemetryStore.togglePaneTelemetry(pane.id)"
    />

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

      <QuickSelectOverlay
        v-if="quickSelect.active.value"
        :hints="quickSelect.hints.value"
        :typed="quickSelect.typed.value"
        :cell-w="quickSelect.metrics.value.cellW"
        :cell-h="quickSelect.metrics.value.cellH"
        :origin-x="quickSelect.metrics.value.originX"
        :origin-y="quickSelect.metrics.value.originY"
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

  <PasteConfirmModal
    v-if="pendingPaste"
    :text="pendingPaste.text"
    :analysis="pendingPaste.analysis"
    @confirm="confirmPaste(false)"
    @single-line="confirmPaste(true)"
    @cancel="cancelPaste"
  />
  <PasteHistoryPicker v-if="isPasteHistoryOpen" @paste="onPasteFromHistory" @close="isPasteHistoryOpen = false; term?.focus()" />
  <TerminalLinkMenu
    v-if="linkMenu"
    :x="linkMenu.x"
    :y="linkMenu.y"
    :items="linkMenuItems"
    @select="onLinkAction"
    @close="linkMenu = null"
  />
</template>
