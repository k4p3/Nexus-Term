<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Search,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-vue-next';

export interface SearchOptions {
  matchCase: boolean;
  wholeWord: boolean;
  regex: boolean;
}

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'search', query: string, options: SearchOptions, direction: 'next' | 'previous'): void;
}>();

const { t } = useI18n();

const query = ref('');
const matchCase = ref(false);
const wholeWord = ref(false);
const regex = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      nextTick(() => {
        searchInput.value?.focus();
        searchInput.value?.select();
      });
      if (query.value.trim()) {
        triggerSearch('next');
      }
    }
  }
);

function triggerSearch(direction: 'next' | 'previous' = 'next') {
  if (!query.value.trim()) return;
  emit('search', query.value, {
    matchCase: matchCase.value,
    wholeWord: wholeWord.value,
    regex: regex.value,
  }, direction);
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    triggerSearch(e.shiftKey ? 'previous' : 'next');
  } else if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="absolute top-8 right-3 z-30 flex items-center gap-1.5 p-1.5 bg-theme-surface border border-theme rounded-xl shadow-2xl backdrop-blur-md text-xs select-none text-theme-main transition-colors"
  >
    <div class="flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-theme-app border border-theme rounded-lg">
      <Search class="w-3.5 h-3.5 text-theme-accent shrink-0" />
      <input
        ref="searchInput"
        v-model="query"
        type="text"
        :placeholder="t('terminal.searchPrompt')"
        @input="triggerSearch('next')"
        @keydown="handleKeyDown"
        class="w-40 sm:w-56 bg-transparent text-theme-main text-xs placeholder-slate-500 focus:outline-hidden"
      />
    </div>

    <!-- Options: Case, Word, RegEx -->
    <div class="flex items-center gap-0.5 bg-theme-app p-0.5 rounded-lg border border-theme text-[11px] font-mono">
      <button
        type="button"
        @click="matchCase = !matchCase; triggerSearch('next')"
        :class="[
          'px-1.5 py-0.5 rounded transition-colors cursor-pointer',
          matchCase ? 'bg-theme-active text-theme-accent font-bold' : 'text-theme-muted hover:text-theme-main',
        ]"
        title="Match Case (Mayúsculas/Minúsculas)"
      >
        Aa
      </button>

      <button
        type="button"
        @click="wholeWord = !wholeWord; triggerSearch('next')"
        :class="[
          'px-1.5 py-0.5 rounded transition-colors cursor-pointer',
          wholeWord ? 'bg-theme-active text-theme-accent font-bold' : 'text-theme-muted hover:text-theme-main',
        ]"
        title="Match Whole Word (Palabra Completa)"
      >
        \b
      </button>

      <button
        type="button"
        @click="regex = !regex; triggerSearch('next')"
        :class="[
          'px-1.5 py-0.5 rounded transition-colors cursor-pointer',
          regex ? 'bg-theme-active text-theme-accent font-bold' : 'text-theme-muted hover:text-theme-main',
        ]"
        title="Use Regular Expression"
      >
        .*
      </button>
    </div>

    <!-- Navigation buttons -->
    <button
      type="button"
      @click="triggerSearch('previous')"
      class="p-1 text-theme-muted hover:text-theme-main rounded-md hover:bg-theme-active transition-colors cursor-pointer"
      title="Previous Match (Shift+Enter)"
    >
      <ChevronUp class="w-3.5 h-3.5" />
    </button>

    <button
      type="button"
      @click="triggerSearch('next')"
      class="p-1 text-theme-muted hover:text-theme-main rounded-md hover:bg-theme-active transition-colors cursor-pointer"
      title="Next Match (Enter)"
    >
      <ChevronDown class="w-3.5 h-3.5" />
    </button>

    <button
      type="button"
      @click="emit('close')"
      class="p-1 text-theme-muted hover:text-red-400 rounded-md hover:bg-theme-active transition-colors ml-1 cursor-pointer"
      title="Close (Esc)"
    >
      <X class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
