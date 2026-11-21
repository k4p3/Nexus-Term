<script setup lang="ts">
withDefaults(defineProps<{ label: string; active?: boolean; tone?: "neutral" | "danger" }>(), {
  active: false,
  tone: "neutral",
});
</script>

<template>
  <button
    type="button"
    :title="label"
    :aria-label="label"
    :aria-pressed="active || undefined"
    class="inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-control transition-colors cursor-pointer"
    :class="[
      active ? 'text-accent bg-accent/15' : 'text-fg-muted hover:bg-active',
      !active && (tone === 'danger' ? 'hover:text-danger' : 'hover:text-fg'),
    ]"
  >
    <slot />
  </button>
</template>
