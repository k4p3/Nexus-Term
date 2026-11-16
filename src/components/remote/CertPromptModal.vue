<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ShieldAlert, ShieldQuestion } from "lucide-vue-next";
import { formatFingerprint } from "../../utils/pointer";

const props = defineProps<{ fingerprint: string; changed: boolean }>();
const emit = defineEmits<{ (e: "accept"): void; (e: "reject"): void }>();
const { t } = useI18n();
const pretty = computed(() => formatFingerprint(props.fingerprint));
</script>

<template>
  <div class="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
    <div class="w-full max-w-md rounded-2xl border border-theme bg-theme-panel p-5 shadow-2xl space-y-3">
      <div class="flex items-center space-x-2" :class="changed ? 'text-red-400' : 'text-amber-400'">
        <component :is="changed ? ShieldAlert : ShieldQuestion" class="w-5 h-5" />
        <h3 class="text-sm font-semibold">
          {{ changed ? t("remote.certTitleChanged") : t("remote.certTitleNew") }}
        </h3>
      </div>
      <p class="text-xs text-theme-muted">
        {{ changed ? t("remote.certDescChanged") : t("remote.certDescNew") }}
      </p>
      <div>
        <div class="text-[11px] text-theme-muted mb-1">{{ t("remote.certFingerprint") }}</div>
        <code class="block break-all rounded-lg bg-theme-input p-2 text-[11px] text-theme-main select-all">{{ pretty }}</code>
      </div>
      <div class="flex justify-end space-x-2 pt-1">
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs border border-theme text-theme-main hover:bg-theme-hover cursor-pointer"
          @click="emit('reject')"
        >{{ t("remote.certReject") }}</button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs bg-theme-accent text-white hover:opacity-90 cursor-pointer"
          @click="emit('accept')"
        >{{ t("remote.certAccept") }}</button>
      </div>
    </div>
  </div>
</template>
