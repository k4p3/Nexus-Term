<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { RotateCcw } from "lucide-vue-next";

defineProps<{ tabCount: number }>();
const emit = defineEmits<{ (e: "restore"): void; (e: "discard"): void }>();
const { t } = useI18n();
const restoreBtn = ref<HTMLButtonElement | null>(null);

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    emit("discard");
  }
}
onMounted(() => restoreBtn.value?.focus());
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" @keydown="onKey">
    <div class="w-full max-w-sm bg-theme-surface border border-theme rounded-2xl shadow-2xl overflow-hidden text-theme-main">
      <div class="px-5 py-3 border-b border-theme flex items-center space-x-2">
        <RotateCcw class="w-4 h-4 text-cyan-300" />
        <h3 class="text-sm font-bold">{{ t("restore.title") }}</h3>
      </div>
      <p class="px-5 py-4 text-xs text-theme-muted">{{ t("restore.body", { n: tabCount }) }}</p>
      <div class="px-5 py-3 border-t border-theme flex justify-end space-x-2">
        <button type="button" class="px-3 py-1.5 rounded-lg text-xs border border-theme hover:bg-theme-hover cursor-pointer" @click="emit('discard')">
          {{ t("restore.startEmpty") }}
        </button>
        <button ref="restoreBtn" type="button" class="px-3 py-1.5 rounded-lg text-xs bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 cursor-pointer" @click="emit('restore')">
          {{ t("restore.restore", { n: tabCount }) }}
        </button>
      </div>
    </div>
  </div>
</template>
