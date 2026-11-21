<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center gap-3 p-8 max-w-sm mx-auto">
    <div class="w-11 h-11 rounded-panel bg-active text-accent flex items-center justify-center" aria-hidden="true">
      <slot name="icon" />
    </div>
    <div class="space-y-1">
      <h3 class="text-base font-semibold text-fg">{{ title }}</h3>
      <p v-if="description" class="text-xs leading-relaxed text-fg-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="flex items-center gap-2 pt-1"><slot /></div>
  </div>
</template>
