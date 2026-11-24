<script setup lang="ts">
import { ref, computed, onBeforeUnmount, defineAsyncComponent } from "vue";
import type { PaneNode } from "../../types/session";
import { computePaneLayout, type LeafLayoutRect, type SplitterLayoutRect } from "../../utils/pane-navigation";
import { useSessionsStore } from "../../stores/sessions.store";
import TerminalPane from "./TerminalPane.vue";

const RemoteDesktopPane = defineAsyncComponent(() => import("../remote/RemoteDesktopPane.vue"));

const isGraphical = (host?: { protocol?: string } | null) =>
  host?.protocol === "rdp" || host?.protocol === "vnc";

const props = defineProps<{
  node: PaneNode;
  tabId: string;
  activePaneId: string;
}>();

const sessionsStore = useSessionsStore();
const containerRef = ref<HTMLDivElement | null>(null);
const draggingSplitId = ref<string | null>(null);

const layout = computed(() => computePaneLayout(props.node));

function pct(v: number): string {
  return `${(v * 100).toFixed(4)}%`;
}

function leafStyle(item: LeafLayoutRect): Record<string, string> {
  // Reserva 2px por cada borde interno compartido con un divisor (equivalente al w-1 / 4px total entre paneles).
  const insetLeft = item.x > 1e-6 ? 2 : 0;
  const insetRight = item.x + item.w < 1 - 1e-6 ? 2 : 0;
  const insetTop = item.y > 1e-6 ? 2 : 0;
  const insetBottom = item.y + item.h < 1 - 1e-6 ? 2 : 0;

  return {
    left: insetLeft ? `calc(${pct(item.x)} + ${insetLeft}px)` : pct(item.x),
    top: insetTop ? `calc(${pct(item.y)} + ${insetTop}px)` : pct(item.y),
    width: insetLeft + insetRight ? `calc(${pct(item.w)} - ${insetLeft + insetRight}px)` : pct(item.w),
    height: insetTop + insetBottom ? `calc(${pct(item.h)} - ${insetTop + insetBottom}px)` : pct(item.h),
  };
}

function splitterStyle(sep: SplitterLayoutRect): Record<string, string> {
  if (sep.direction === "horizontal") {
    return {
      left: `calc(${pct(sep.x)} - 2px)`,
      top: pct(sep.y),
      width: "4px",
      height: pct(sep.h),
    };
  }
  return {
    left: pct(sep.x),
    top: `calc(${pct(sep.y)} - 2px)`,
    width: pct(sep.w),
    height: "4px",
  };
}

let activeListenersCleanup: (() => void) | null = null;

function startResize(sep: SplitterLayoutRect, ev: PointerEvent) {
  const el = containerRef.value;
  if (!el) return;
  ev.preventDefault();
  draggingSplitId.value = sep.id;

  const splitId = sep.id;
  const direction = sep.direction;
  const { containerX, containerY, containerW, containerH } = sep;

  const onMove = (moveEv: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    if (direction === "horizontal") {
      if (containerW <= 0) return;
      const normX = (moveEv.clientX - rect.left) / rect.width;
      const nextRatio = (normX - containerX) / containerW;
      sessionsStore.setSplitRatio(props.tabId, splitId, nextRatio);
    } else {
      if (containerH <= 0) return;
      const normY = (moveEv.clientY - rect.top) / rect.height;
      const nextRatio = (normY - containerY) / containerH;
      sessionsStore.setSplitRatio(props.tabId, splitId, nextRatio);
    }
  };

  const cleanup = () => {
    draggingSplitId.value = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", cleanup);
    window.removeEventListener("pointercancel", cleanup);
    activeListenersCleanup = null;
  };

  activeListenersCleanup?.();
  activeListenersCleanup = cleanup;
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", cleanup);
  window.addEventListener("pointercancel", cleanup);
}

onBeforeUnmount(() => {
  activeListenersCleanup?.();
});
</script>

<template>
  <div ref="containerRef" class="relative h-full w-full flex-1 overflow-hidden bg-line">
    <!-- Lista plana de hojas: :key="item.pane.id" garantiza que ningún panel existente se desmonte al dividir o cerrar -->
    <div
      v-for="item in layout.leaves"
      :key="item.pane.id"
      :data-pane-id="item.pane.id"
      class="absolute overflow-hidden flex flex-col"
      :class="draggingSplitId ? 'pointer-events-none select-none' : ''"
      :style="leafStyle(item)"
    >
      <RemoteDesktopPane
        v-if="isGraphical(item.pane.host)"
        :pane="item.pane"
        :tab-id="tabId"
        :is-active="item.pane.id === activePaneId"
      />
      <TerminalPane
        v-else
        :pane="item.pane"
        :tab-id="tabId"
        :is-active="item.pane.id === activePaneId"
      />
    </div>

    <!-- Divisores interactivos superpuestos -->
    <div
      v-for="sep in layout.splitters"
      :key="sep.id"
      :data-splitter-id="sep.id"
      role="separator"
      :aria-orientation="sep.direction === 'horizontal' ? 'vertical' : 'horizontal'"
      class="absolute z-20 transition-colors touch-none"
      :class="[
        sep.direction === 'horizontal' ? 'cursor-col-resize' : 'cursor-row-resize',
        draggingSplitId === sep.id ? 'bg-accent' : 'bg-line hover:bg-accent',
      ]"
      :style="splitterStyle(sep)"
      @pointerdown="startResize(sep, $event)"
    ></div>
  </div>
</template>
