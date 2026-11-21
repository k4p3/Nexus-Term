<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useUiStore } from "../../stores/ui.store";
import { useSessionsStore } from "../../stores/sessions.store";

const ui = useUiStore();
const sessions = useSessionsStore();
const { t } = useI18n();

function go(id: number, tabId?: string, paneId?: string) {
  if (tabId) {
    sessions.activeTabId = tabId;
    if (paneId) sessions.setActivePane(tabId, paneId);
  }
  ui.dismissToast(id);
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[60] flex flex-col space-y-2 w-80 max-w-[calc(100vw-2rem)]">
    <div
      v-for="toast in ui.toasts"
      :key="toast.id"
      class="rounded-xl border px-3 py-2 text-xs shadow-xl flex items-start justify-between space-x-3 bg-surface"
      :class="toast.kind === 'warning' ? 'border-warning/50 text-warning' : toast.kind === 'success' ? 'border-success/50 text-success' : 'border-line text-fg'"
      role="status"
    >
      <span class="whitespace-pre-line break-words min-w-0">{{ toast.message }}</span>
      <span class="flex items-center space-x-2 shrink-0">
        <button v-if="toast.tabId" type="button" class="text-accent hover:underline cursor-pointer" @click="go(toast.id, toast.tabId, toast.paneId)">{{ t("toast.go") }}</button>
        <button type="button" class="text-fg-muted hover:text-fg cursor-pointer" aria-label="close" @click="ui.dismissToast(toast.id)">✕</button>
      </span>
    </div>
  </div>
</template>
