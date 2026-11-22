<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useSnippetsStore } from "../../stores/snippets.store";
import { useSnippetText } from "../../composables/useSnippetText";
import type { Candidate } from "../../utils/completion-candidates";
import type { PopupAnchor } from "../../utils/popup-anchor";
import { AUTOCOMPLETE_MAX_ROWS } from "../../composables/useAutocomplete";

const props = defineProps<{ candidates: Candidate[]; index: number; anchor: PopupAnchor }>();
const emit = defineEmits<{ (e: "select", c: Candidate): void; (e: "hover", i: number): void }>();

const { t } = useI18n();
const snippets = useSnippetsStore();
const { snippetTitle } = useSnippetText();
const list = ref<HTMLDivElement | null>(null);

function subtitle(c: Candidate): string | undefined {
  if (c.kind === "snippet") {
    const s = snippets.snippets.find((x) => x.id === c.snippetId);
    return `${t("autocomplete.snippet")}${s ? `: ${snippetTitle(s)}` : ""}`;
  }
  return c.exitCode !== null && c.exitCode !== 0 ? `✗ ${c.exitCode}` : undefined;
}

watch(
  () => props.index,
  () => nextTick(() => list.value?.querySelector<HTMLElement>("[data-active='true']")?.scrollIntoView({ block: "nearest" })),
);
</script>

<template>
  <!-- Sin foco propio: las teclas siguen yendo a la terminal; mousedown.prevent evita robarlo con el ratón. -->
  <div
    class="fixed z-50 w-[480px] max-w-[calc(100vw-1rem)] bg-surface border border-line rounded-lg shadow-2xl overflow-hidden text-fg text-xs"
    :style="{ left: anchor.left + 'px', ...(anchor.above ? { bottom: `calc(100vh - ${anchor.top}px)` } : { top: anchor.top + 'px' }) }"
    role="listbox"
    :aria-label="t('autocomplete.label')"
    @mousedown.prevent
  >
    <div ref="list" class="overflow-y-auto" :style="{ maxHeight: AUTOCOMPLETE_MAX_ROWS * 28 + 'px' }">
      <button
        v-for="(c, i) in candidates"
        :key="c.id"
        type="button"
        role="option"
        :aria-selected="i === index"
        :data-active="i === index"
        class="w-full h-7 flex items-center justify-between gap-3 px-3 text-left font-mono cursor-pointer"
        :class="i === index ? 'bg-active text-fg' : 'text-fg-muted hover:bg-active'"
        @mousemove="emit('hover', i)"
        @click="emit('select', c)"
      >
        <span class="truncate">{{ c.text.replace(/\s+/g, " ") }}</span>
        <span v-if="subtitle(c)" class="shrink-0 text-[10px] text-fg-muted">{{ subtitle(c) }}</span>
      </button>
      <div v-if="candidates.length === 0" class="px-3 py-2 text-fg-muted">{{ t("autocomplete.empty") }}</div>
    </div>
    <div class="h-[26px] flex items-center px-3 border-t border-line text-[10px] text-fg-muted">{{ t("autocomplete.hint") }}</div>
  </div>
</template>
