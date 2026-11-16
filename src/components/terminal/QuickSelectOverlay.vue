<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { Hint } from "../../utils/quick-select";

defineProps<{
  hints: Hint[];
  typed: string;
  cellW: number;
  cellH: number;
  originX: number;
  originY: number;
}>();
const { t } = useI18n();
</script>

<template>
  <div class="absolute inset-0 z-20 pointer-events-none bg-black/55">
    <div
      v-for="(h, i) in hints"
      :key="i"
      class="absolute rounded-sm outline outline-1 outline-amber-400/70"
      :style="{ left: originX + h.col * cellW + 'px', top: originY + h.row * cellH + 'px', width: h.len * cellW + 'px', height: cellH + 'px' }"
    >
      <span
        class="absolute -top-0.5 left-0 px-1 text-[11px] leading-4 font-mono font-bold rounded-sm bg-amber-400 text-black"
        :class="h.label.startsWith(typed.toLowerCase()) ? '' : 'opacity-30'"
      >{{ h.label }}</span>
    </div>
    <div class="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg text-[11px] bg-theme-surface border border-theme text-theme-main">
      {{ t("quickSelect.hint") }}
    </div>
  </div>
</template>
