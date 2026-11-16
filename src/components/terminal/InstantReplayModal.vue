<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { History, X } from "lucide-vue-next";
import { useSettingsStore } from "../../stores/settings.store";
import type { ReplayBuffer } from "../../utils/replay-buffer";

const props = defineProps<{ buffer: ReplayBuffer; cols: number; rows: number }>();
const emit = defineEmits<{ (e: "close"): void }>();

const { t } = useI18n();
const settings = useSettingsStore();

const host = ref<HTMLDivElement | null>(null);
const span = ref<[number, number] | null>(props.buffer.span);
const position = ref<number>(span.value ? span.value[1] : 0); // ms absolutos
const slider = ref<HTMLInputElement | null>(null);

// Visor de solo lectura: no tiene onData, por lo que nunca envía entrada a la sesión.
let term: Terminal | null = null;
let fit: FitAddon | null = null;
let rendered = -Infinity; // instante hasta el que ya se ha escrito
let raf = 0;

const secondsFromEnd = computed(() =>
  span.value ? Math.max(0, Math.round((span.value[1] - position.value) / 1000)) : 0,
);
const totalSeconds = computed(() => (span.value ? Math.round((span.value[1] - span.value[0]) / 1000) : 0));

function renderAt(target: number) {
  if (!term || !span.value) return;
  const [start] = span.value;
  if (target < rendered) {
    term.reset();
    rendered = start - 1;
  }
  for (const chunk of props.buffer.range(Math.max(rendered + 1, start), target)) term.write(chunk);
  rendered = target;
}

function onSlide() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => renderAt(position.value));
}

function step(deltaMs: number) {
  if (!span.value) return;
  position.value = Math.min(span.value[1], Math.max(span.value[0], position.value + deltaMs));
  onSlide();
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    emit("close");
  } else if (e.key === "ArrowLeft" && !(e.target instanceof HTMLInputElement)) {
    step(-5000);
  } else if (e.key === "ArrowRight" && !(e.target instanceof HTMLInputElement)) {
    step(5000);
  }
}

onMounted(() => {
  if (!host.value) return;
  term = new Terminal({
    cols: props.cols,
    rows: props.rows,
    disableStdin: true,
    cursorBlink: false,
    scrollback: 5000,
    fontFamily: settings.settings.font_family,
    fontSize: settings.settings.font_size,
    lineHeight: settings.settings.line_height,
    theme: settings.activeTheme,
  });
  fit = new FitAddon();
  term.loadAddon(fit);
  term.open(host.value);
  try {
    fit.fit();
  } catch {
    /* el contenedor aún sin tamaño: se mantiene cols/rows del panel */
  }
  renderAt(position.value);
  slider.value?.focus();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  term?.dispose();
  term = null;
});
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" @keydown="onKey">
    <div class="w-full max-w-5xl max-h-[90vh] flex flex-col bg-theme-surface border border-theme rounded-2xl shadow-2xl overflow-hidden text-theme-main">
      <div class="px-5 py-3 border-b border-theme flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <History class="w-4 h-4 text-cyan-300" />
          <h3 class="text-sm font-bold">{{ t("replay.title") }}</h3>
          <span class="text-[10px] px-1.5 py-0.5 rounded border border-theme text-theme-muted">{{ t("replay.readOnly") }}</span>
        </div>
        <button type="button" class="p-1 rounded hover:bg-theme-hover cursor-pointer" :title="t('common.close')" @click="emit('close')">
          <X class="w-4 h-4" />
        </button>
      </div>

      <div v-if="!span" class="px-5 py-10 text-center text-xs text-theme-muted">{{ t("replay.empty") }}</div>
      <template v-else>
        <div class="flex-1 min-h-[16rem] overflow-hidden bg-black p-2">
          <div ref="host" class="w-full h-full"></div>
        </div>
        <div class="px-5 py-3 border-t border-theme space-y-2">
          <input
            ref="slider"
            v-model.number="position"
            type="range"
            class="w-full"
            :min="span[0]"
            :max="span[1]"
            step="100"
            :aria-label="t('replay.timeline')"
            @input="onSlide"
          />
          <div class="flex items-center justify-between text-[11px] text-theme-muted">
            <span>{{ secondsFromEnd === 0 ? t("replay.now") : t("replay.secondsAgo", { n: secondsFromEnd }) }}</span>
            <span class="space-x-1">
              <button type="button" class="px-2 py-0.5 rounded border border-theme hover:bg-theme-hover cursor-pointer" @click="step(-5000)">−5s</button>
              <button type="button" class="px-2 py-0.5 rounded border border-theme hover:bg-theme-hover cursor-pointer" @click="step(5000)">+5s</button>
              <button type="button" class="px-2 py-0.5 rounded border border-theme hover:bg-theme-hover cursor-pointer" @click="position = span![1]; onSlide()">{{ t("replay.toEnd") }}</button>
            </span>
            <span>{{ t("replay.window", { n: totalSeconds }) }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
