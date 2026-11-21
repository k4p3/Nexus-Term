<script setup lang="ts">
import { Loader2 } from "lucide-vue-next";

withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md";
    loading?: boolean;
    disabled?: boolean;
    type?: "button" | "submit";
  }>(),
  { variant: "secondary", size: "md", loading: false, disabled: false, type: "button" },
);

const VARIANTS = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover font-semibold",
  secondary: "bg-active text-fg border border-line hover:border-accent/50",
  ghost: "text-fg-muted hover:text-fg hover:bg-active",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
} as const;
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    class="inline-flex items-center justify-center gap-1.5 rounded-control text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[VARIANTS[variant], size === 'sm' ? 'h-7 px-2.5' : 'h-(--control-h) px-3.5']"
  >
    <Loader2 v-if="loading" class="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
    <slot />
  </button>
</template>
