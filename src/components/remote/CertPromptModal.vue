<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ShieldAlert, ShieldQuestion } from "lucide-vue-next";
import BaseButton from "../common/BaseButton.vue";
import { formatFingerprint } from "../../utils/pointer";

const props = defineProps<{ fingerprint: string; changed: boolean }>();
const emit = defineEmits<{ (e: "accept"): void; (e: "reject"): void }>();
const { t } = useI18n();
const pretty = computed(() => formatFingerprint(props.fingerprint));
</script>

<template>
  <div class="absolute inset-0 z-30 flex items-center justify-center bg-overlay p-4">
    <div class="w-full max-w-md rounded-modal border border-line bg-surface p-5 shadow-2xl space-y-3" role="alertdialog" aria-modal="true">
      <div class="flex items-center space-x-2" :class="changed ? 'text-danger' : 'text-warning'">
        <component :is="changed ? ShieldAlert : ShieldQuestion" class="w-5 h-5" />
        <h3 class="text-sm font-semibold">
          {{ changed ? t("remote.certTitleChanged") : t("remote.certTitleNew") }}
        </h3>
      </div>
      <p class="text-xs text-fg-muted">
        {{ changed ? t("remote.certDescChanged") : t("remote.certDescNew") }}
      </p>
      <div>
        <div class="text-[11px] text-fg-muted mb-1">{{ t("remote.certFingerprint") }}</div>
        <code class="block break-all rounded-lg bg-app p-2 text-[11px] text-fg select-all">{{ pretty }}</code>
      </div>
      <div class="flex justify-end gap-2 pt-1">
        <BaseButton variant="secondary" data-autofocus @click="emit('reject')">{{ t("remote.certReject") }}</BaseButton>
        <BaseButton :variant="changed ? 'danger' : 'primary'" @click="emit('accept')">{{ t("remote.certAccept") }}</BaseButton>
      </div>
    </div>
  </div>
</template>
