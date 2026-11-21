<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ShieldAlert } from "lucide-vue-next";
import { previewSegments, type PasteAnalysis } from "../../utils/paste-guard";

const props = defineProps<{ text: string; analysis: PasteAnalysis }>();
const emit = defineEmits<{ (e: "confirm"): void; (e: "single-line"): void; (e: "cancel"): void }>();
const { t } = useI18n();

const segments = computed(() => previewSegments(props.text, props.analysis.dangerous));
const cancelBtn = ref<HTMLButtonElement | null>(null);

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    emit("cancel");
  }
}

// Foco inicial en «Cancelar»: confirmar requiere una acción explícita.
onMounted(() => cancelBtn.value?.focus());
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-xs p-4" @keydown="onKey">
    <div class="w-full max-w-lg bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden text-fg">
      <div class="px-5 py-3 border-b border-line flex items-center space-x-2" :class="analysis.dangerous.length || analysis.controlChars ? 'text-warning' : ''">
        <ShieldAlert class="w-4 h-4" />
        <h3 class="text-sm font-bold">{{ t("paste.title") }}</h3>
      </div>
      <div class="p-5 space-y-3">
        <div class="text-xs text-fg-muted">
          {{ t("paste.summary", { lines: analysis.lines, bytes: analysis.bytes }) }}
        </div>
        <ul class="text-xs space-y-1">
          <li v-if="analysis.dangerous.length" class="text-warning">⚠ {{ t("paste.dangerous") }}</li>
          <li v-if="analysis.controlChars || analysis.zeroWidth" class="text-danger">⚠ {{ t("paste.control") }}</li>
          <li v-if="analysis.looksSecret" class="text-accent">ℹ {{ t("paste.secret") }}</li>
        </ul>
        <pre class="max-h-56 overflow-auto rounded-xl bg-app border border-line p-3 text-[11px] font-mono whitespace-pre-wrap break-all select-text"><template v-for="(seg, i) in segments" :key="i"><mark v-if="seg.danger" class="bg-warning/15 text-warning rounded-sm px-0.5">{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template></pre>
      </div>
      <div class="px-5 py-3 border-t border-line flex justify-end space-x-2">
        <button ref="cancelBtn" type="button" class="px-3 py-1.5 rounded-lg text-xs border border-line hover:bg-active cursor-pointer" @click="emit('cancel')">
          {{ t("paste.cancel") }}
        </button>
        <button v-if="analysis.lines > 1" type="button" class="px-3 py-1.5 rounded-lg text-xs border border-line hover:bg-active cursor-pointer" @click="emit('single-line')">
          {{ t("paste.oneLine") }}
        </button>
        <button type="button" class="px-3 py-1.5 rounded-lg text-xs bg-accent text-on-accent hover:opacity-90 cursor-pointer" @click="emit('confirm')">
          {{ t("paste.confirm") }}
        </button>
      </div>
    </div>
  </div>
</template>
