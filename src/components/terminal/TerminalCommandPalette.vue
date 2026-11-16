<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ListPicker, { type PickerItem } from "../common/ListPicker.vue";
import SnippetParamModal from "../snippets/SnippetParamModal.vue";
import { useUiStore, type TerminalActionId } from "../../stores/ui.store";
import { useSessionsStore } from "../../stores/sessions.store";
import { useSettingsStore } from "../../stores/settings.store";
import { useSnippetsStore } from "../../stores/snippets.store";
import { sessionService } from "../../services/session.service";
import { SHORTCUTS, currentPlatform, formatShortcut } from "../../utils/shortcuts";
import type { CommandSnippet } from "../../types/snippets";

const emit = defineEmits<{ (e: "close"): void }>();
const { t } = useI18n();
const ui = useUiStore();
const sessions = useSessionsStore();
const settings = useSettingsStore();
const snippets = useSnippetsStore();
const platform = currentPlatform();

const paramSnippet = ref<CommandSnippet | null>(null);

const activePaneId = computed(() => {
  const tab = sessions.tabs.find((x) => x.id === sessions.activeTabId);
  return tab?.activePaneId ?? null;
});

function hintFor(shortcutId: string): string | undefined {
  const s = SHORTCUTS.find((x) => x.id === shortcutId);
  return s ? formatShortcut(s, platform) : undefined;
}

interface Entry {
  item: PickerItem;
  run: () => void;
}

const TERMINAL_ACTIONS: { action: TerminalActionId; shortcut: string }[] = [
  { action: "search", shortcut: "terminal.search" },
  { action: "quickSelect", shortcut: "terminal.quickSelect" },
  { action: "pasteHistory", shortcut: "terminal.pasteHistory" },
  { action: "history", shortcut: "terminal.history" },
  { action: "instantReplay", shortcut: "terminal.instantReplay" },
  { action: "rerunBlock", shortcut: "terminal.rerunBlock" },
  { action: "copyBlockCommand", shortcut: "" },
  { action: "prevPrompt", shortcut: "terminal.prevPrompt" },
  { action: "nextPrompt", shortcut: "terminal.nextPrompt" },
  { action: "copyLastOutput", shortcut: "" },
  { action: "splitH", shortcut: "terminal.splitH" },
  { action: "splitV", shortcut: "terminal.splitV" },
  { action: "closePane", shortcut: "terminal.closePane" },
];

const entries = computed<Entry[]>(() => {
  const out: Entry[] = [];
  const pane = activePaneId.value;

  // Las acciones de terminal solo aparecen si el panel activo las registra (no en RDP/VNC).
  for (const { action, shortcut } of TERMINAL_ACTIONS) {
    if (!pane || !ui.paneActions[pane]?.[action]) continue;
    out.push({
      item: { id: `a:${action}`, title: t(`palette.actions.${action}`), hint: shortcut ? hintFor(shortcut) : undefined },
      run: () => ui.runPaneAction(pane, action),
    });
  }

  out.push({
    item: { id: "w:broadcast", title: t("palette.actions.broadcast"), hint: hintFor("workspace.broadcast") },
    run: () => sessions.toggleBroadcastMode(),
  });
  out.push({
    item: { id: "g:quickConnect", title: t("palette.actions.quickConnect"), hint: hintFor("app.quickConnect") },
    run: () => ui.openQuickConnect(),
  });
  out.push({
    item: { id: "g:shortcuts", title: t("palette.actions.shortcuts"), hint: hintFor("app.shortcuts") },
    run: () => (ui.shortcutsOpen = true),
  });

  for (const th of settings.allThemes) {
    out.push({
      item: { id: `t:${th.id}`, title: t("palette.theme", { name: th.name }), subtitle: t("palette.themeCategory") },
      run: () => settings.updateSettings({ theme_id: th.id }),
    });
  }

  if (pane) {
    for (const sn of snippets.enabledSnippets) {
      out.push({
        item: { id: `s:${sn.id}`, title: sn.title, subtitle: t("palette.snippetCategory") },
        run: () => runSnippet(sn),
      });
    }
  }
  return out;
});

const items = computed(() => entries.value.map((e) => e.item));

function sendToActivePane(command: string) {
  const pane = activePaneId.value;
  const sessionId = pane ? sessions.paneSessionMap[pane] : undefined;
  if (sessionId) sessionService.writeSession(sessionId, new TextEncoder().encode(command));
}

function runSnippet(sn: CommandSnippet) {
  if (snippets.extractParameters(sn.command_template).length > 0) {
    paramSnippet.value = sn; // flujo existente de parámetros
  } else {
    sendToActivePane(sn.command_template + "\n");
    emit("close");
  }
}

function onSelect(id: string) {
  const entry = entries.value.find((e) => e.item.id === id);
  if (!entry) return;
  emit("close");
  // Tras cerrar, el foco vuelve al terminal y la acción se ejecuta sobre el panel activo.
  setTimeout(entry.run, 0);
}

function onSnippetExecute(command: string) {
  sendToActivePane(command + "\n");
  paramSnippet.value = null;
  emit("close");
}
</script>

<template>
  <ListPicker
    v-if="!paramSnippet"
    :items="items"
    :placeholder="t('palette.placeholder')"
    :empty-text="t('palette.empty')"
    @select="onSelect"
    @close="emit('close')"
  />
  <SnippetParamModal :is-open="!!paramSnippet" :snippet="paramSnippet" @close="paramSnippet = null; emit('close')" @execute="onSnippetExecute" />
</template>
