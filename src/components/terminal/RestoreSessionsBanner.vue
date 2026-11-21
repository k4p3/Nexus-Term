<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { RotateCcw } from "lucide-vue-next";

defineProps<{ tabCount: number }>();
const emit = defineEmits<{ (e: "restore"): void; (e: "discard"): void }>();
const { t } = useI18n();
</script>

<template>
  <!-- Oferta no modal: no bloquea la pantalla ni roba el foco de la terminal -->
  <div
    class="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100%-2rem)] flex items-center space-x-3 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-fg shadow-xl"
    role="status"
  >
    <RotateCcw class="w-4 h-4 text-accent shrink-0" />
    <span class="min-w-0">{{ t("restore.bannerBody", { n: tabCount }) }}</span>
    <button type="button" class="shrink-0 px-2.5 py-1 rounded-lg bg-accent text-on-accent font-semibold hover:bg-accent-hover cursor-pointer" @click="emit('restore')">
      {{ t("restore.bannerRestore") }}
    </button>
    <button type="button" class="shrink-0 text-fg-muted hover:text-fg hover:underline cursor-pointer" @click="emit('discard')">
      {{ t("restore.bannerDiscard") }}
    </button>
  </div>
</template>
