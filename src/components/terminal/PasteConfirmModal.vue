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

// Foco inicial en "Cancelar": confirmar requiere una acción explícita.
onMounted(() => cancelBtn.value?.focus());
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" @keydown="onKey">
    <div class="w-full max-w-lg bg-theme-surface border border-theme rounded-2xl shadow-2xl overflow-hidden text-theme-main">
      <div class="px-5 py-3 border-b border-theme flex items-center space-x-2" :class="analysis.dangerous.length || analysis.controlChars ? 'text-amber-300' : ''">
        <ShieldAlert class="w-4 h-4" />
        <h3 class="text-sm font-bold">{{ t("paste.title") }}</h3>
      </div>
      <div class="p-5 space-y-3">
        <div class="text-xs text-theme-muted">
          {{ t("paste.summary", { lines: analysis.lines, bytes: analysis.bytes }) }}
        </div>
        <ul class="text-xs space-y-1">
          <li v-if="analysis.dangerous.length" class="text-amber-300">⚠ {{ t("paste.dangerous") }}</li>
          <li v-if="analysis.controlChars || analysis.zeroWidth" class="text-red-300">⚠ {{ t("paste.control") }}</li>
          <li v-if="analysis.looksSecret" class="text-sky-300">ℹ {{ t("paste.secret") }}</li>
        </ul>
        <pre class="max-h-56 overflow-auto rounded-xl bg-theme-input border border-theme p-3 text-[11px] font-mono whitespace-pre-wrap break-all select-text"><template v-for="(seg, i) in segments" :key="i"><mark v-if="seg.danger" class="bg-amber-500/30 text-amber-200 rounded-sm px-0.5">{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template></pre>
      </div>
      <div class="px-5 py-3 border-t border-theme flex justify-end space-x-2">
        <button ref="cancelBtn" type="button" class="px-3 py-1.5 rounded-lg text-xs border border-theme hover:bg-theme-hover cursor-pointer" @click="emit('cancel')">
          {{ t("paste.cancel") }}
        </button>
        <button v-if="analysis.lines > 1" type="button" class="px-3 py-1.5 rounded-lg text-xs border border-theme hover:bg-theme-hover cursor-pointer" @click="emit('single-line')">
          {{ t("paste.oneLine") }}
        </button>
        <button type="button" class="px-3 py-1.5 rounded-lg text-xs bg-theme-accent text-white hover:opacity-90 cursor-pointer" @click="emit('confirm')">
          {{ t("paste.confirm") }}
        </button>
      </div>
    </div>
  </div>
</template>
