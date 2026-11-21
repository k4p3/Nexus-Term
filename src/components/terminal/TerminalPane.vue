<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { ImageAddon } from "@xterm/addon-image";
import { CanvasAddon } from "@xterm/addon-canvas";
import { LigaturesAddon } from "@xterm/addon-ligatures";
import {
  TerminalAddonManager, planAddons, createWriteOnlyClipboardProvider, IMAGE_STORAGE_LIMIT_MB, type AddonSpec,
} from "../../utils/terminal-addons";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { sessionService } from "../../services/session.service";
import { useEnsureUnlocked } from "../../composables/useEnsureUnlocked";
import { useSessionsStore } from "../../stores/sessions.store";
import { useSettingsStore } from "../../stores/settings.store";
import { useVaultStore } from "../../stores/vault.store";
import { useTelemetryStore } from "../../stores/telemetry.store";
import TerminalSearchBar, { type SearchOptions } from "./TerminalSearchBar.vue";
import { useReplayStore } from "../../stores/replay.store";
import { useHistoryStore } from "../../stores/history.store";
import QuickSelectOverlay from "./QuickSelectOverlay.vue";
import type { LinkMenuItem } from "./TerminalLinkMenu.vue";

// Carga bajo demanda de modales secundarios
const PasteConfirmModal = defineAsyncComponent(() => import("./PasteConfirmModal.vue"));
const PasteHistoryPicker = defineAsyncComponent(() => import("./PasteHistoryPicker.vue"));
const HistoryPicker = defineAsyncComponent(() => import("./HistoryPicker.vue"));
const InstantReplayModal = defineAsyncComponent(() => import("./InstantReplayModal.vue"));
const TerminalLinkMenu = defineAsyncComponent(() => import("./TerminalLinkMenu.vue"));
import { useUiStore } from "../../stores/ui.store";
import { usePasteHistoryStore } from "../../stores/paste-history.store";
import { useSftpStore } from "../../stores/sftp.store";
import { useQuickSelect } from "../../composables/useQuickSelect";
import { matchShortcut } from "../../utils/shortcuts";
import { analyzePaste, toSingleLine, type PasteAnalysis } from "../../utils/paste-guard";
import { findIpLinks, findPathLinks, dirname } from "../../utils/link-detect";
import { BlockTracker, searchInRange, formatDuration, type CommandBlock, type SearchMatch } from "../../utils/command-blocks";
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
const historyStore = useHistoryStore();
const sftpStore = useSftpStore();

// Pegado seguro, historial de pegado y menú de enlaces
const pendingPaste = ref<{ text: string; analysis: PasteAnalysis; execute?: boolean } | null>(null);
const isPasteHistoryOpen = ref(false);
const isHistoryOpen = ref(false);
const isReplayOpen = ref(false);
const replayStore = useReplayStore();
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
  if (!p) return;
  doPaste(singleLine ? toSingleLine(p.text) : p.text);
  if (p.execute) term?.input("\r");
}

function cancelPaste() {
  pendingPaste.value = null;
  term?.focus();
}

/**
 * Inserta un comando en el prompt (y opcionalmente lo ejecuta). Pasa por las reglas de seguridad
 * del pegado: si es peligroso o multilínea se pide confirmación antes de insertar/ejecutar.
 */
function insertCommand(text: string, execute = false) {
  if (!text) return;
  if (execute) term?.input("\x15"); // Ctrl+U: limpia lo que hubiera escrito en el prompt
  const analysis = analyzePaste(text);
  if (settingsStore.settings.paste_warning && analysis.needsConfirm) {
    pendingPaste.value = { text, analysis, execute };
    return;
  }
  doPaste(text);
  if (execute) term?.input("\r");
}

/** Instant Replay: retiene la salida con marca de tiempo solo en memoria, si el ajuste está activo. */
function recordOutput(chunk: Uint8Array) {
  if (!settingsStore.settings.instant_replay) return;
  replayStore.bufferFor(props.pane.id).push(Date.now(), chunk);
}

function openReplay() {
  if (!settingsStore.settings.instant_replay) {
    uiStore.pushToast(t("replay.disabled"));
    return;
  }
  isReplayOpen.value = true;
}

function onHistoryInsert(text: string, execute: boolean) {
  isHistoryOpen.value = false;
  term?.focus();
  insertCommand(text, execute);
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

let lastCommandText: string | undefined;

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
    command: lastCommandText,
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
const connectionLost = ref(false);
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

// Shell integration (OSC 133): bloques basados en markers de xterm
let tracker: BlockTracker | null = null;
const blockCount = ref(0);
const selectedBlockId = ref<number | null>(null);
const lastExitCode = ref<number | null>(null);
const lastDuration = ref<string | null>(null);
const isOutputCopied = ref(false);

let unlistenClosed: UnlistenFn | null = null;
let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let searchAddon: SearchAddon | null = null;
let resizeObserver: ResizeObserver | null = null;
let sessionId: string | null = null;

watch(
  () => settingsStore.settings.instant_replay,
  (on) => {
    if (!on) replayStore.release(props.pane.id);
  },
);

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
  if (selectedBlockId.value !== null && searchWithinBlock(query, options, direction)) return;
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
  clearBlockSearch();
  term?.focus();
}

function refreshBlockCount() {
  blockCount.value = tracker?.executed().length ?? 0;
  if (selectedBlockId.value !== null && !tracker?.find(selectedBlockId.value)) {
    selectedBlockId.value = null;
    clearBlockSearch();
  }
}

function jumpToPreviousPrompt() {
  if (!term || !tracker) return;
  const blocks = tracker.executed();
  if (blocks.length === 0) return;
  const currentLine = term.buffer.active.viewportY;
  const prev = [...blocks].reverse().find((b) => b.prompt.line < currentLine - 1);
  term.scrollToLine((prev ?? blocks[0]).prompt.line);
}

function jumpToNextPrompt() {
  if (!term || !tracker) return;
  const currentLine = term.buffer.active.viewportY;
  const next = tracker.executed().find((b) => b.prompt.line > currentLine + 1);
  if (next) {
    term.scrollToLine(next.prompt.line);
  } else {
    term.scrollToBottom();
  }
}

/** Bloque seleccionado o, si no hay, el último ejecutado. */
function targetBlock(): CommandBlock | undefined {
  if (!tracker) return undefined;
  if (selectedBlockId.value !== null) {
    const b = tracker.find(selectedBlockId.value);
    if (b) return b;
  }
  const all = tracker.executed();
  return all[all.length - 1];
}

function flashCopied() {
  isOutputCopied.value = true;
  setTimeout(() => {
    isOutputCopied.value = false;
  }, 2000);
}

function copyLastOutput() {
  const b = targetBlock();
  if (!b || !tracker) return;
  const text = tracker.outputText(b);
  if (text) {
    navigator.clipboard.writeText(text);
    flashCopied();
  }
}

function copyBlockCommand() {
  const b = targetBlock();
  if (!b || !tracker) return;
  const text = tracker.commandText(b);
  if (text) {
    navigator.clipboard.writeText(text);
    flashCopied();
  }
}

/** Repite el comando del bloque seleccionado (o del último), sujeto a las reglas de pegado seguro. */
function rerunBlockCommand() {
  const b = targetBlock();
  if (!b || !tracker) return;
  const text = tracker.commandText(b);
  if (text) insertCommand(text, true);
}

function selectBlock(id: number | null) {
  selectedBlockId.value = id;
  clearBlockSearch();
  if (!term) return;
  if (id === null || !tracker) {
    term.clearSelection();
    return;
  }
  const b = tracker.find(id);
  if (!b) return;
  const r = tracker.lineRange(b);
  term.selectLines(r.start, r.end);
}

// Búsqueda acotada a un bloque
let blockMatches: SearchMatch[] = [];
let blockMatchIdx = -1;

function clearBlockSearch() {
  blockMatches = [];
  blockMatchIdx = -1;
}

function searchWithinBlock(query: string, options: SearchOptions, direction: 'next' | 'previous') {
  const b = selectedBlockId.value !== null ? tracker?.find(selectedBlockId.value) : undefined;
  if (!term || !tracker || !b) return false;
  blockMatches = searchInRange(term, tracker.lineRange(b), query, { caseSensitive: options.matchCase });
  if (blockMatches.length === 0) {
    blockMatchIdx = -1;
    term.clearSelection();
    return true;
  }
  const step = direction === 'next' ? 1 : -1;
  blockMatchIdx = (blockMatchIdx + step + blockMatches.length) % blockMatches.length;
  const m = blockMatches[blockMatchIdx];
  term.select(m.col, m.line, m.length);
  term.scrollToLine(Math.max(0, m.line - 2));
  return true;
}

// Indicador ✓/✗ + duración en el margen derecho de la línea del prompt
function decorateBlock(b: CommandBlock) {
  if (!term || b.exitCode === undefined) return;
  const ok = b.exitCode === 0;
  const label = `${ok ? "✓" : "✗"}${b.durationMs !== undefined ? " " + formatDuration(b.durationMs) : ""}`;
  const deco = term.registerDecoration({ marker: b.prompt, x: 0, anchor: "right", width: label.length + 1 });
  deco?.onRender((el) => {
    el.textContent = label;
    el.style.cssText = `color:${ok ? "#34d399" : "#fb7185"};font-size:0.8em;text-align:right;cursor:pointer;opacity:.85`;
    el.title = ok
      ? t("terminal.blockOk", { time: formatDuration(b.durationMs) })
      : t("terminal.blockFailed", { code: b.exitCode, time: formatDuration(b.durationMs) });
    el.onclick = () => selectBlock(selectedBlockId.value === b.id ? null : b.id);
  });
}

let addonManager: TerminalAddonManager | null = null;

function buildAddonSpecs(t0: Terminal): Record<"unicode11" | "clipboard" | "canvas" | "webgl" | "ligatures" | "image", AddonSpec> {
  return {
    unicode11: {
      create: () => new Unicode11Addon(),
      onLoaded: () => {
        t0.unicode.activeVersion = "11";
      },
    },
    clipboard: {
      create: () =>
        new ClipboardAddon(
          createWriteOnlyClipboardProvider(
            (text) => navigator.clipboard.writeText(text),
            {
              onCopied: () => uiStore.pushToast(t("terminal.osc52Copied"), { kind: "success" }),
              onRejected: () => uiStore.pushToast(t("terminal.osc52TooLarge"), { kind: "warning" }),
            },
          ) as never,
        ),
    },
    image: { create: () => new ImageAddon({ storageLimit: IMAGE_STORAGE_LIMIT_MB }) },
    canvas: { create: () => new CanvasAddon() },
    ligatures: { create: () => new LigaturesAddon() },
    webgl: {
      create: () => {
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => webgl.dispose());
        return webgl;
      },
    },
  };
}

/** Carga/descarta addons según las preferencias; si cambia el renderizador se reajusta el tamaño. */
function applyAddonPrefs() {
  if (!addonManager) return;
  const changed = addonManager.apply(
    planAddons({
      osc52_clipboard: settingsStore.settings.osc52_clipboard,
      inline_images: settingsStore.settings.inline_images,
      font_ligatures: settingsStore.settings.font_ligatures,
    }),
  );
  if (changed.includes("webgl") || changed.includes("canvas") || changed.includes("ligatures")) {
    nextTick(() => {
      fitAddon?.fit();
      term?.refresh(0, Math.max(0, (term?.rows ?? 1) - 1));
    });
  }
}

watch(
  () => [
    settingsStore.settings.osc52_clipboard,
    settingsStore.settings.inline_images,
    settingsStore.settings.font_ligatures,
  ],
  applyAddonPrefs,
);

const { runWithUnlock } = useEnsureUnlocked();

// Indica qué panel está activo cuando la pestaña está dividida (en broadcast ya hay un borde ámbar):
// cabecera con tinte y título en color de acento. Los cursores de los paneles inactivos se dibujan huecos.
const showActiveIndicator = computed(
  () =>
    props.isActive &&
    !sessionsStore.isBroadcastMode &&
    sessionsStore.getLeafPanesInTab(props.tabId).length > 1,
);

/** Ajusta xterm al contenedor y avisa de las nuevas filas/columnas a la sesión. */
function refit() {
  if (!fitAddon || !term) return;
  fitAddon.fit();
  if (sessionId) sessionService.resizeSession(sessionId, term.cols, term.rows);
}

async function connectSession() {
  if (!term) return;
  try {
    isConnecting.value = true;
    errorMessage.value = null;
    connectionLost.value = false;

    if (props.pane.hostId) {
      const hostId = props.pane.hostId;
      const cols = term.cols;
      const rows = term.rows;
      // Si la bóveda está bloqueada se pide el desbloqueo y se reintenta (p. ej. pestañas restauradas).
      const opened = await runWithUnlock(() =>
        sessionService.connectSsh(hostId, cols, rows, (chunk) => {
          term?.write(chunk);
          recordOutput(chunk);
        }),
      );
      if (opened === undefined) throw t("vault.unlockCancelled");
      sessionId = opened;
    } else {
      sessionId = await sessionService.openLocalPty(
        term.cols,
        term.rows,
        (chunk) => {
          term?.write(chunk);
          recordOutput(chunk);
        },
        settingsStore.settings.default_shell
      );
    }
    if (sessionId) {
      sessionsStore.registerPaneSession(props.pane.id, sessionId);
      if (props.pane.hostId) {
        const watchedId = sessionId;
        unlistenClosed?.();
        unlistenClosed = await listen<string>("ssh-session-closed", (ev) => {
          if (ev.payload !== watchedId) return;
          term?.write(`\r\n\x1b[1;31m${t("terminal.connectionLost")}\x1b[0m\r\n`);
          connectionLost.value = true;
          sessionsStore.unregisterPaneSession(props.pane.id);
          sessionId = null;
        });
      }
    }
    isConnecting.value = false;
  } catch (err: any) {
    isConnecting.value = false;
    errorMessage.value = typeof err === "string" ? err : err?.message || "Error al conectar la sesión.";
  }
}

onMounted(async () => {
  if (!terminalContainer.value) return;

  // Initialize xterm with user settings
  term = new Terminal({
    cursorBlink: settingsStore.settings.cursor_blink,
    cursorStyle: settingsStore.settings.cursor_style,
    cursorInactiveStyle: 'outline', // cursor hueco en los paneles sin foco
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

  // Register OSC 133 Shell Integration Parser (bloques basados en markers)
  tracker = new BlockTracker(term as unknown as ConstructorParameters<typeof BlockTracker>[0]);
  term.parser.registerOscHandler(133, (data) => {
    const [action, ...args] = data.split(';');
    const finished = tracker?.onOsc(action, args);
    if (finished && finished.exitCode !== undefined) {
      const cmdText = finished.commandStart ? tracker?.commandText(finished, false) ?? '' : '';
      if (cmdText) {
        void historyStore.record(props.pane.hostId, cmdText, finished.exitCode, settingsStore.settings.history_enabled);
      }
      lastCommandText = cmdText || undefined;
      lastExitCode.value = finished.exitCode;
      decorateBlock(finished);
      if (finished.durationMs) {
        lastDuration.value = (finished.durationMs / 1000).toFixed(1) + 's';
        notifyCommandFinished(finished.exitCode, finished.durationMs);
      }
    }
    refreshBlockCount();
    return true;
  });
  term.onScroll(refreshBlockCount);

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
      'terminal.rerunBlock': rerunBlockCommand,
      'terminal.history': () => (isHistoryOpen.value = true),
      'terminal.instantReplay': openReplay,
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

  // Addons de compatibilidad (Unicode 11, OSC 52, imágenes, ligaduras) y renderizador WebGL
  addonManager = new TerminalAddonManager(
    term as unknown as ConstructorParameters<typeof TerminalAddonManager>[0],
    buildAddonSpecs(term),
    (name, e) => console.warn(`Addon "${name}" unavailable, continuing without it`, e),
  );
  applyAddonPrefs();

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

  // El tamaño debe vigilarse ANTES de conectar: la terminal inicial se crea al arrancar y su contenedor
  // puede cambiar de tamaño (diseño, tipografía) mientras se abre la sesión.
  resizeObserver = new ResizeObserver(refit);
  resizeObserver.observe(terminalContainer.value);
  // Al cargar la fuente cambia el tamaño de celda; sin esto quedaría un margen vacío bajo la terminal.
  void document.fonts?.ready.then(refit);
  requestAnimationFrame(refit);

  await connectSession();
  refit(); // la sesión se abrió con el tamaño de antes de conectar: se sincroniza con el actual

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
    rerunBlock: rerunBlockCommand,
    history: () => (isHistoryOpen.value = true),
    instantReplay: openReplay,
    copyBlockCommand,
  });
  term.focus();
});

onBeforeUnmount(async () => {
  unlistenClosed?.();
  unlistenClosed = null;
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
  addonManager?.dispose();
  addonManager = null;
  tracker?.dispose();
  tracker = null;
  replayStore.release(props.pane.id);
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
    class="flex-1 flex flex-col h-full w-full bg-theme-app overflow-hidden relative transition-colors"
    :class="[
      sessionsStore.isBroadcastMode
        ? 'border border-amber-500/60 ring-1 ring-amber-500/40'
        : '',
    ]"
  >
    <!-- Pane Mini Header -->
    <div
      class="h-7 border-b flex items-center justify-between px-2.5 text-xs select-none shrink-0 transition-colors duration-200"
      :class="sessionsStore.isBroadcastMode ? 'bg-amber-950/30 border-amber-800/60' : 'bg-theme-header border-theme'"
      :style="showActiveIndicator ? { backgroundColor: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-bg-header))' } : undefined"
    >
      <div class="flex items-center space-x-2 truncate">
        <Server v-if="pane.hostId" class="w-3.5 h-3.5 text-theme-accent shrink-0" />
        <TerminalIcon v-else class="w-3.5 h-3.5 text-purple-400 shrink-0" />
        <span class="text-[11px] font-medium truncate transition-colors duration-200" :class="showActiveIndicator ? 'text-theme-accent' : 'text-theme-main'">{{ pane.title }}</span>

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
          v-if="blockCount > 0"
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
          v-if="blockCount > 0"
          @click.stop="jumpToPreviousPrompt"
          title="Comando Anterior (Ctrl+Shift+↑)"
          class="p-1 text-slate-400 hover:text-white rounded-sm hover:bg-slate-800 transition-colors"
        >
          <ChevronUp class="w-3 h-3" />
        </button>
        <button
          v-if="blockCount > 0"
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
      <!-- xterm ajusta a filas enteras: el resto de píxeles toma el fondo del tema para que no se note -->
      <div
        v-show="!errorMessage"
        ref="terminalContainer"
        class="w-full h-full"
        :style="{ backgroundColor: settingsStore.activeTheme.background }"
      ></div>

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

      <!-- Connection lost: offer reconnect -->
      <div v-if="connectionLost" class="absolute bottom-4 left-1/2 -translate-x-1/2">
        <button
          @click="connectSession"
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white rounded-lg shadow-lg transition"
        >
          {{ t("terminal.reconnect") }}
        </button>
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
  <InstantReplayModal v-if="isReplayOpen && term" :buffer="replayStore.bufferFor(pane.id)" :cols="term.cols" :rows="term.rows" @close="isReplayOpen = false; term?.focus()" />
  <HistoryPicker v-if="isHistoryOpen" :host-id="pane.hostId" @insert="onHistoryInsert" @close="isHistoryOpen = false; term?.focus()" />
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
