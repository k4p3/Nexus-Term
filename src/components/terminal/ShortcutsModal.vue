<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { X, Keyboard } from "lucide-vue-next";
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

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    emit("close");
  }
}
onMounted(() => window.addEventListener("keydown", onKey, true));
onUnmounted(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" @mousedown.self="emit('close')">
    <div class="w-full max-w-2xl max-h-[85vh] bg-theme-surface border border-theme rounded-2xl shadow-2xl overflow-hidden flex flex-col text-theme-main">
      <div class="px-5 py-3.5 border-b border-theme flex items-center justify-between bg-theme-header">
        <div class="flex items-center space-x-2">
          <Keyboard class="w-5 h-5 text-theme-accent" />
          <h3 class="text-sm font-bold">{{ t("shortcutsModal.title") }}</h3>
        </div>
        <button type="button" class="p-1 rounded-lg text-theme-muted hover:text-theme-main hover:bg-theme-active cursor-pointer" @click="emit('close')">
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="p-5 overflow-y-auto space-y-5">
        <section v-for="g in groups" :key="g.group">
          <h4 class="text-[11px] uppercase tracking-wide font-semibold text-theme-muted mb-2">{{ t(`shortcutsModal.groups.${g.group}`) }}</h4>
          <div class="space-y-1">
            <div v-for="i in g.items" :key="i.id" class="flex items-center justify-between text-xs py-1">
              <span>{{ i.title }}</span>
              <kbd class="px-2 py-0.5 rounded border border-theme text-theme-muted font-mono text-[11px]">{{ i.keys }}</kbd>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
