<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { RotateCcw } from "lucide-vue-next";
import BaseModal from "../common/BaseModal.vue";
import BaseButton from "../common/BaseButton.vue";

defineProps<{ tabCount: number }>();
const emit = defineEmits<{ (e: "restore"): void; (e: "discard"): void }>();
const { t } = useI18n();
</script>

<template>
  <BaseModal :title="t('restore.title')" size="sm" @close="emit('discard')">
    <template #icon><RotateCcw class="w-4 h-4" /></template>
    <p class="text-xs leading-relaxed text-fg-muted">{{ t("restore.body", { n: tabCount }) }}</p>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('discard')">{{ t("restore.startEmpty") }}</BaseButton>
      <BaseButton variant="primary" data-autofocus @click="emit('restore')">{{ t("restore.restore", { n: tabCount }) }}</BaseButton>
    </template>
  </BaseModal>
</template>
