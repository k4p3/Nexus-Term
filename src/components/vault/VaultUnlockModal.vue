<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { X } from "lucide-vue-next";
import VaultUnlockScreen from "./VaultUnlockScreen.vue";
import { useEnsureUnlocked } from "../../composables/useEnsureUnlocked";

// Se carga con defineAsyncComponent desde App.vue (solo aparece bajo demanda).
const { t } = useI18n();
const { resolvePrompt } = useEnsureUnlocked();

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") resolvePrompt(false);
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true">
    <VaultUnlockScreen class="bg-transparent" @done="resolvePrompt(true)" />
    <button
      type="button"
      class="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
      :aria-label="t('vault.cancel')"
      :title="t('vault.cancel')"
      @click="resolvePrompt(false)"
    >
      <X class="w-5 h-5" />
    </button>
  </div>
</template>
