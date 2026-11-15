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
    class="absolute top-8 right-3 z-30 flex items-center gap-1.5 p-1.5 bg-neutral-900/95 border border-neutral-700/80 rounded-xl shadow-2xl backdrop-blur-md text-xs select-none"
  >
    <div class="flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-neutral-950 border border-neutral-800 rounded-lg">
      <Search class="w-3.5 h-3.5 text-cyan-400 shrink-0" />
      <input
        ref="searchInput"
        v-model="query"
        type="text"
        :placeholder="t('terminal.searchPrompt')"
        @input="triggerSearch('next')"
        @keydown="handleKeyDown"
        class="w-40 sm:w-56 bg-transparent text-white text-xs placeholder-neutral-500 focus:outline-hidden"
      />
    </div>

    <!-- Options: Case, Word, RegEx -->
    <div class="flex items-center gap-0.5 bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-[11px] font-mono">
      <button
        type="button"
        @click="matchCase = !matchCase; triggerSearch('next')"
        :class="[
          'px-1.5 py-0.5 rounded transition-colors',
          matchCase ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-neutral-400 hover:text-neutral-200',
        ]"
        title="Match Case (Mayúsculas/Minúsculas)"
      >
        Aa
      </button>

      <button
        type="button"
        @click="wholeWord = !wholeWord; triggerSearch('next')"
        :class="[
          'px-1.5 py-0.5 rounded transition-colors',
          wholeWord ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-neutral-400 hover:text-neutral-200',
        ]"
        title="Match Whole Word (Palabra Completa)"
      >
        \b
      </button>

      <button
        type="button"
        @click="regex = !regex; triggerSearch('next')"
        :class="[
          'px-1.5 py-0.5 rounded transition-colors',
          regex ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-neutral-400 hover:text-neutral-200',
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
      class="p-1 text-neutral-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
      title="Previous Match (Shift+Enter)"
    >
      <ChevronUp class="w-3.5 h-3.5" />
    </button>

    <button
      type="button"
      @click="triggerSearch('next')"
      class="p-1 text-neutral-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
      title="Next Match (Enter)"
    >
      <ChevronDown class="w-3.5 h-3.5" />
    </button>

    <button
      type="button"
      @click="emit('close')"
      class="p-1 text-neutral-400 hover:text-rose-400 rounded-md hover:bg-neutral-800 transition-colors ml-1"
      title="Close (Esc)"
    >
      <X class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
