<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { X } from "lucide-vue-next";
import { useI18n } from "vue-i18n";

const props = withDefaults(defineProps<{ title: string; size?: "sm" | "md" | "lg" }>(), { size: "md" });
const emit = defineEmits<{ (e: "close"): void }>();
const { t } = useI18n();

const SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;
const panel = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    emit("close");
  }
}

onMounted(() => {
  previouslyFocused = document.activeElement as HTMLElement | null;
  window.addEventListener("keydown", onKey, true);
  const target = panel.value?.querySelector<HTMLElement>("input, select, textarea, [data-autofocus]") ?? panel.value;
  target?.focus();
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKey, true);
  previouslyFocused?.focus?.();
});
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-xs p-4" @mousedown.self="emit('close')">
    <div
      ref="panel"
      role="dialog"
      aria-modal="true"
      :aria-label="props.title"
      tabindex="-1"
      class="w-full max-h-[85vh] flex flex-col bg-surface border border-line rounded-modal shadow-2xl overflow-hidden text-fg outline-hidden"
      :class="SIZES[size]"
    >
      <header class="h-12 px-4 flex items-center justify-between gap-3 border-b border-line shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-accent flex items-center"><slot name="icon" /></span>
          <h2 class="text-sm font-semibold truncate">{{ props.title }}</h2>
        </div>
        <button
          type="button"
          :title="t('common.close')"
          :aria-label="t('common.close')"
          class="w-7 h-7 flex items-center justify-center rounded-control text-fg-muted hover:text-fg hover:bg-active cursor-pointer"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </header>
      <div class="p-4 overflow-y-auto"><slot /></div>
      <footer v-if="$slots.footer" class="px-4 py-3 border-t border-line flex items-center justify-end gap-2 shrink-0 bg-header">
        <slot name="footer" />
      </footer>
    </div>
  </div>
</template>
