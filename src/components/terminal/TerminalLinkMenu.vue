<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

export interface LinkMenuItem {
  id: string;
  label: string;
}

defineProps<{ x: number; y: number; items: LinkMenuItem[] }>();
const emit = defineEmits<{ (e: "select", id: string): void; (e: "close"): void }>();

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}
const onOutside = () => emit("close");
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("mousedown", onOutside, true);
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKey, true);
  window.removeEventListener("mousedown", onOutside, true);
});
</script>

<template>
  <div
    class="fixed z-50 min-w-44 py-1 rounded-xl border border-line bg-surface shadow-2xl text-xs text-fg"
    :style="{ left: x + 'px', top: y + 'px' }"
    @mousedown.stop
  >
    <button
      v-for="it in items"
      :key="it.id"
      type="button"
      class="w-full text-left px-3 py-1.5 hover:bg-active cursor-pointer"
      @click="emit('select', it.id)"
    >{{ it.label }}</button>
  </div>
</template>
