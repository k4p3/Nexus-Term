<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Maximize2, Scaling, Keyboard, Unplug, X } from "lucide-vue-next";

defineProps<{ title: string; protocol: string; scaleMode: "fit" | "actual"; connected: boolean }>();
const emit = defineEmits<{
  (e: "cad"): void;
  (e: "fullscreen"): void;
  (e: "toggle-scale"): void;
  (e: "disconnect"): void;
  (e: "close"): void;
}>();
const { t } = useI18n();
const btn = "p-1.5 rounded-lg text-theme-muted hover:text-theme-main hover:bg-theme-hover transition cursor-pointer disabled:opacity-40 disabled:cursor-default";
</script>

<template>
  <div class="flex items-center justify-between px-3 py-1.5 border-b border-theme bg-theme-panel shrink-0">
    <div class="flex items-center space-x-2 min-w-0">
      <span class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-theme-accent/20 text-theme-accent">{{ protocol }}</span>
      <span class="text-xs text-theme-main truncate">{{ title }}</span>
    </div>
    <div class="flex items-center space-x-0.5">
      <button :class="btn" :disabled="!connected" :title="t('remote.ctrlAltDel')" @click="emit('cad')"><Keyboard class="w-4 h-4" /></button>
      <button :class="btn" :title="scaleMode === 'fit' ? t('remote.actualSize') : t('remote.fit')" @click="emit('toggle-scale')"><Scaling class="w-4 h-4" /></button>
      <button :class="btn" :title="t('remote.fullscreen')" @click="emit('fullscreen')"><Maximize2 class="w-4 h-4" /></button>
      <button :class="btn" :disabled="!connected" :title="t('remote.disconnect')" @click="emit('disconnect')"><Unplug class="w-4 h-4" /></button>
      <button :class="btn" :title="t('remote.close')" @click="emit('close')"><X class="w-4 h-4" /></button>
    </div>
  </div>
</template>
