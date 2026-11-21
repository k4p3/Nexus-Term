<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Keyboard } from "lucide-vue-next";
import BaseModal from "../common/BaseModal.vue";
import { SHORTCUTS, currentPlatform, formatShortcut, type ShortcutGroup } from "../../utils/shortcuts";

const emit = defineEmits<{ (e: "close"): void }>();
const { t } = useI18n();
const platform = currentPlatform();

const GROUP_ORDER: ShortcutGroup[] = ["navigation", "panes", "selection", "clipboard", "tools"];
const groups = computed(() =>
  GROUP_ORDER.map((g) => ({
    group: g,
    items: SHORTCUTS.filter((s) => s.group === g).map((s) => ({
      id: s.id,
      title: t(s.titleKey),
      keys: formatShortcut(s, platform),
    })),
  })).filter((g) => g.items.length > 0),
);

</script>

<template>
  <BaseModal :title="t('shortcutsModal.title')" size="lg" @close="emit('close')">
    <template #icon><Keyboard class="w-4 h-4" /></template>
    <div class="space-y-5">
      <section v-for="g in groups" :key="g.group">
        <h3 class="text-xs font-semibold text-fg-muted mb-2">{{ t(`shortcutsModal.groups.${g.group}`) }}</h3>
        <ul class="divide-y divide-line/60">
          <li v-for="i in g.items" :key="i.id" class="flex items-center justify-between text-xs py-1.5">
            <span>{{ i.title }}</span>
            <kbd class="px-2 py-0.5 rounded-control border border-line bg-app text-fg-muted font-mono text-[11px]">{{ i.keys }}</kbd>
          </li>
        </ul>
      </section>
    </div>
  </BaseModal>
</template>
