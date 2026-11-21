<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { fuzzyFilter } from "../../utils/fuzzy";

export interface PickerItem {
  id: string;
  title: string;
  subtitle?: string;
  hint?: string;
  disabled?: boolean;
}

const props = defineProps<{
  items: PickerItem[];
  placeholder: string;
  emptyText: string;
  /** Ordenación propia (p. ej. por uso y recencia); por defecto, difusa por título. */
  ranker?: (items: PickerItem[], query: string) => PickerItem[];
}>();
const emit = defineEmits<{ (e: "select", id: string, withCtrl: boolean): void; (e: "close"): void }>();

const query = ref("");
const index = ref(0);
const input = ref<HTMLInputElement | null>(null);
const list = ref<HTMLDivElement | null>(null);

const filtered = computed(() =>
  (props.ranker
    ? props.ranker(props.items, query.value)
    : fuzzyFilter(props.items, query.value, (i) => `${i.title} ${i.subtitle ?? ""}`)
  ).filter((i) => !i.disabled),
);

watch(query, () => (index.value = 0));

function scrollToActive() {
  nextTick(() => list.value?.querySelector<HTMLElement>("[data-active='true']")?.scrollIntoView({ block: "nearest" }));
}

function onKey(e: KeyboardEvent) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    index.value = Math.min(index.value + 1, filtered.value.length - 1);
    scrollToActive();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    index.value = Math.max(index.value - 1, 0);
    scrollToActive();
  } else if (e.key === "Enter") {
    e.preventDefault();
    const item = filtered.value[index.value];
    if (item) emit("select", item.id, e.ctrlKey || e.metaKey);
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    emit("close");
  }
}

onMounted(() => input.value?.focus());
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-overlay backdrop-blur-xs p-4" @mousedown.self="emit('close')">
    <div class="w-full max-w-xl bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden text-fg">
      <input
        ref="input"
        v-model="query"
        type="text"
        :placeholder="placeholder"
        class="w-full px-4 py-3 bg-transparent border-b border-line text-sm focus:outline-none placeholder-fg-muted"
        @keydown="onKey"
      />
      <div ref="list" class="max-h-80 overflow-y-auto py-1">
        <button
          v-for="(item, i) in filtered"
          :key="item.id"
          type="button"
          :data-active="i === index"
          class="w-full flex items-center justify-between px-4 py-2 text-left text-sm transition-colors cursor-pointer"
          :class="i === index ? 'bg-active text-fg' : 'text-fg-muted hover:bg-active'"
          @mousemove="index = i"
          @click="emit('select', item.id, false)"
        >
          <span class="min-w-0">
            <span class="block truncate">{{ item.title }}</span>
            <span v-if="item.subtitle" class="block truncate text-[11px] text-fg-muted">{{ item.subtitle }}</span>
          </span>
          <kbd v-if="item.hint" class="ml-3 shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-line text-fg-muted">{{ item.hint }}</kbd>
        </button>
        <div v-if="filtered.length === 0" class="px-4 py-6 text-center text-xs text-fg-muted">{{ emptyText }}</div>
      </div>
    </div>
  </div>
</template>
