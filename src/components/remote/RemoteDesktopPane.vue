<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { Loader2, AlertCircle, ShieldAlert, RefreshCw } from "lucide-vue-next";
import { useRemoteDesktopStore } from "../../stores/remote-desktop.store";
import { useSessionsStore } from "../../stores/sessions.store";
import { useSettingsStore } from "../../stores/settings.store";
import { decodeFrame } from "../../utils/frame-decoder";
import { codeToScancode, domButtonsToMask, keysymFromKey, shouldCaptureKey, wheelNotches } from "../../utils/keymap";
import { clientToRemote, fitSize } from "../../utils/pointer";
import { FRAME_KIND_CURSOR, FRAME_KIND_RECT, FRAME_KIND_RESIZE } from "../../types/remote-desktop";
import type { LeafPane } from "../../types/session";
import RemoteToolbar from "./RemoteToolbar.vue";
import CertPromptModal from "./CertPromptModal.vue";

const props = defineProps<{ pane: LeafPane; tabId: string; isActive: boolean }>();

const { t } = useI18n();
const rd = useRemoteDesktopStore();
const sessionsStore = useSessionsStore();
const settings = useSettingsStore();

const root = ref<HTMLDivElement | null>(null);
const viewport = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const cursorCss = ref("default");
const scaleMode = ref<"fit" | "actual">("fit");
const fbSize = ref({ w: 0, h: 0 });
const boxSize = ref({ w: 0, h: 0 });

const session = computed(() => rd.sessions[props.pane.id]);
const connected = computed(() => session.value?.state === "connected");
const canvasStyle = computed(() => {
  const s = fitSize(boxSize.value, fbSize.value, scaleMode.value);
  return { width: `${s.w}px`, height: `${s.h}px`, cursor: cursorCss.value };
});

let ctx: CanvasRenderingContext2D | null = null;
let resizeObserver: ResizeObserver | null = null;
const cursorCanvas = document.createElement("canvas");

// El payload proviene siempre de un ArrayBuffer (Tauri Channel), nunca de un SharedArrayBuffer.
function toImageData(p: Uint8Array, w: number, h: number): ImageData {
  return new ImageData(new Uint8ClampedArray(p.buffer as ArrayBuffer, p.byteOffset, p.byteLength), w, h);
}

function handleFrame(buf: ArrayBuffer) {
  let f;
  try {
    f = decodeFrame(buf);
  } catch (e) {
    console.error("Frame inválido:", e);
    return;
  }
  const cv = canvas.value;
  if (!cv) return;
  if (f.kind === FRAME_KIND_RESIZE) {
    cv.width = f.w;
    cv.height = f.h;
    fbSize.value = { w: f.w, h: f.h };
    ctx = cv.getContext("2d");
  } else if (f.kind === FRAME_KIND_RECT) {
    ctx ??= cv.getContext("2d");
    ctx?.putImageData(toImageData(f.payload, f.w, f.h), f.x, f.y);
  } else if (f.kind === FRAME_KIND_CURSOR) {
    if (f.w === 0 || f.h === 0) {
      cursorCss.value = "default";
      return;
    }
    cursorCanvas.width = f.w;
    cursorCanvas.height = f.h;
    cursorCanvas.getContext("2d")?.putImageData(toImageData(f.payload, f.w, f.h), 0, 0);
    cursorCss.value = `url(${cursorCanvas.toDataURL()}) ${f.x} ${f.y}, default`;
  }
}

function measure() {
  const el = viewport.value;
  if (el) boxSize.value = { w: el.clientWidth, h: el.clientHeight };
}

async function start() {
  const host = props.pane.host;
  if (!host) return;
  await nextTick();
  measure();
  const w = Math.max(640, Math.min(boxSize.value.w || 1280, 8192));
  const h = Math.max(480, Math.min(boxSize.value.h || 720, 8192));
  await rd.connect(props.pane.id, host.id, w, h, handleFrame);
}

// ---- Entrada --------------------------------------------------------------
let pendingMove: { x: number; y: number; buttons: number } | null = null;
let rafId = 0;

function remoteCoords(e: MouseEvent) {
  const cv = canvas.value!;
  return clientToRemote(e.clientX, e.clientY, cv.getBoundingClientRect(), { w: cv.width, h: cv.height });
}

function flushMove() {
  rafId = 0;
  if (pendingMove) {
    rd.sendInput(props.pane.id, { type: "pointer", ...pendingMove });
    pendingMove = null;
  }
}

function onMouseMove(e: MouseEvent) {
  const { x, y } = remoteCoords(e);
  pendingMove = { x, y, buttons: domButtonsToMask(e.buttons) };
  if (!rafId) rafId = requestAnimationFrame(flushMove);
}

function onMouseButton(e: MouseEvent) {
  e.preventDefault();
  canvas.value?.focus();
  pendingMove = null;
  const { x, y } = remoteCoords(e);
  rd.sendInput(props.pane.id, { type: "pointer", x, y, buttons: domButtonsToMask(e.buttons) });
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const { x, y } = remoteCoords(e);
  const dy = wheelNotches(e.deltaY);
  const dx = wheelNotches(-e.deltaX);
  if (dy || dx) rd.sendInput(props.pane.id, { type: "wheel", x, y, dx, dy });
}

function onKey(e: KeyboardEvent, down: boolean) {
  if (!shouldCaptureKey(e)) return;
  const info = codeToScancode(e.code);
  if (!info) return;
  e.preventDefault();
  e.stopPropagation();
  if (down && e.repeat === false) maybePushClipboard();
  rd.sendInput(props.pane.id, {
    type: "key",
    scancode: info.scancode,
    extended: info.extended,
    down,
    keysym: keysymFromKey(e.key),
  });
}

// ---- Portapapeles (solo texto) --------------------------------------------
let lastLocalClip = "";
async function maybePushClipboard() {
  if (!settings.settings.remote_desktop_clipboard || !connected.value) return;
  try {
    const text = await navigator.clipboard.readText();
    if (text && text !== lastLocalClip) {
      lastLocalClip = text;
      await rd.setClipboard(props.pane.id, text);
    }
  } catch {
    /* permiso denegado o portapapeles no disponible */
  }
}

watch(
  () => session.value?.remoteClipboard,
  async (text) => {
    if (!text || !settings.settings.remote_desktop_clipboard) return;
    lastLocalClip = text;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* sin permiso */
    }
  },
);

// ---- Barra de herramientas -------------------------------------------------
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else root.value?.requestFullscreen?.();
}

async function closePane() {
  await rd.disconnect(props.pane.id);
  sessionsStore.closePane(props.tabId, props.pane.id);
}

onMounted(() => {
  if (viewport.value) {
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(viewport.value);
  }
  start();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (rafId) cancelAnimationFrame(rafId);
  rd.disconnect(props.pane.id);
});

watch(
  () => props.isActive,
  (a) => a && nextTick(() => canvas.value?.focus()),
);
</script>

<template>
  <div ref="root" class="h-full w-full flex flex-col bg-app relative">
    <RemoteToolbar
      :title="pane.title"
      :protocol="session?.protocol ?? pane.host?.protocol ?? 'rdp'"
      :scale-mode="scaleMode"
      :connected="connected"
      @cad="rd.sendCtrlAltDel(pane.id)"
      @fullscreen="toggleFullscreen"
      @toggle-scale="scaleMode = scaleMode === 'fit' ? 'actual' : 'fit'"
      @disconnect="rd.disconnect(pane.id)"
      @close="closePane"
    />

    <div
      v-if="session?.unencryptedWarning"
      class="flex items-center space-x-2 px-3 py-1 text-[11px] bg-warning/15 text-warning border-b border-warning/30"
    >
      <ShieldAlert class="w-3.5 h-3.5 shrink-0" />
      <span>{{ t("remote.unencryptedWarning") }}</span>
    </div>

    <div ref="viewport" class="flex-1 min-h-0 overflow-auto flex items-center justify-center relative">
      <canvas
        ref="canvas"
        tabindex="0"
        class="outline-none bg-app"
        :style="canvasStyle"
        @mousemove="onMouseMove"
        @mousedown="onMouseButton"
        @mouseup="onMouseButton"
        @contextmenu.prevent
        @wheel="onWheel"
        @keydown="onKey($event, true)"
        @keyup="onKey($event, false)"
      />

      <div
        v-if="session?.state === 'connecting'"
        class="absolute inset-0 flex flex-col items-center justify-center bg-overlay text-fg-muted text-sm space-y-2"
      >
        <Loader2 class="w-6 h-6 animate-spin" />
        <span>{{ t("remote.connecting", { host: pane.title }) }}</span>
      </div>

      <div
        v-else-if="session && (session.state === 'error' || session.state === 'disconnected')"
        class="absolute inset-0 flex flex-col items-center justify-center bg-overlay text-sm space-y-3 p-4 text-center"
      >
        <AlertCircle class="w-7 h-7" :class="session.state === 'error' ? 'text-danger' : 'text-fg-muted'" />
        <div class="text-fg">
          {{ session.state === "error" ? t("remote.connectionError") : t("remote.disconnected") }}
        </div>
        <div v-if="session.error" class="text-xs text-fg-muted max-w-md break-words">{{ session.error }}</div>
        <button
          type="button"
          class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs bg-accent text-on-accent hover:opacity-90 cursor-pointer"
          @click="start"
        >
          <RefreshCw class="w-3.5 h-3.5" />
          <span>{{ t("remote.reconnect") }}</span>
        </button>
      </div>
    </div>

    <CertPromptModal
      v-if="session?.certPrompt"
      :fingerprint="session.certPrompt.fingerprint"
      :changed="session.certPrompt.changed"
      @accept="rd.resolveCert(pane.id, true)"
      @reject="rd.resolveCert(pane.id, false)"
    />
  </div>
</template>
