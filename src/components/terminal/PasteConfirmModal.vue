<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ShieldAlert } from "lucide-vue-next";
import { previewSegments, type PasteAnalysis } from "../../utils/paste-guard";
import BaseModal from "../common/BaseModal.vue";
import BaseButton from "../common/BaseButton.vue";

const props = defineProps<{ text: string; analysis: PasteAnalysis }>();
const emit = defineEmits<{ (e: "confirm"): void; (e: "single-line"): void; (e: "cancel"): void }>();
const { t } = useI18n();

const segments = computed(() => previewSegments(props.text, props.analysis.dangerous));
</script>

<template>
  <BaseModal :title="t('paste.title')" size="md" @close="emit('cancel')">
    <template #icon><ShieldAlert class="w-4 h-4" :class="analysis.dangerous.length || analysis.controlChars ? 'text-warning' : ''" /></template>
    <div class="space-y-3">
      <p class="text-xs text-fg-muted">
        {{ t("paste.summary", { lines: analysis.lines, bytes: analysis.bytes }) }}
      </p>
      <ul class="text-xs space-y-1">
        <li v-if="analysis.dangerous.length" class="text-warning">⚠ {{ t("paste.dangerous") }}</li>
        <li v-if="analysis.controlChars || analysis.zeroWidth" class="text-danger">⚠ {{ t("paste.control") }}</li>
        <li v-if="analysis.looksSecret" class="text-accent">ℹ {{ t("paste.secret") }}</li>
      </ul>
      <pre class="max-h-56 overflow-auto rounded-control bg-app border border-line p-3 text-[11px] font-mono whitespace-pre-wrap break-all select-text"><template v-for="(seg, i) in segments" :key="i"><mark v-if="seg.danger" class="bg-warning/15 text-warning rounded-sm px-0.5">{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template></pre>
    </div>
    <template #footer>
      <!-- Foco inicial en «Cancelar»: confirmar requiere una acción explícita. -->
      <BaseButton variant="secondary" data-autofocus @click="emit('cancel')">{{ t("paste.cancel") }}</BaseButton>
      <BaseButton v-if="analysis.lines > 1" variant="secondary" @click="emit('single-line')">{{ t("paste.oneLine") }}</BaseButton>
      <BaseButton variant="primary" @click="emit('confirm')">{{ t("paste.confirm") }}</BaseButton>
    </template>
  </BaseModal>
</template>
