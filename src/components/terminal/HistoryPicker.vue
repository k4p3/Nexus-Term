<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import ListPicker, { type PickerItem } from "../common/ListPicker.vue";
import { useHistoryStore } from "../../stores/history.store";
import { useSnippetsStore } from "../../stores/snippets.store";
import { rankHistory } from "../../utils/history-filter";

const props = defineProps<{ hostId: string | null | undefined }>();
const emit = defineEmits<{
  (e: "insert", text: string, execute: boolean): void;
  (e: "close"): void;
}>();

const { t } = useI18n();
const history = useHistoryStore();
const snippets = useSnippetsStore();

onMounted(async () => {
  await history.load(props.hostId);
  if (snippets.snippets.length === 0) await snippets.fetchSnippets();
});

interface Meta {
  text: string;
  use_count: number;
  last_used_at: string;
}

const meta = computed(() => {
  const m = new Map<string, Meta>();
  for (const e of history.entries) m.set(`h:${e.id}`, { text: e.command, use_count: e.use_count, last_used_at: e.last_used_at });
  for (const s of snippets.enabledSnippets)
    m.set(`s:${s.id}`, { text: `${s.title} ${s.command_template}`, use_count: 0, last_used_at: "" });
  return m;
});

const items = computed<PickerItem[]>(() => [
  ...history.entries.map((e) => ({
    id: `h:${e.id}`,
    title: e.command.replace(/\s+/g, " "),
    subtitle: e.last_exit_code !== null && e.last_exit_code !== 0 ? `✗ ${e.last_exit_code}` : undefined,
    hint: e.use_count > 1 ? `×${e.use_count}` : undefined,
  })),
  ...snippets.enabledSnippets.map((s) => ({
    id: `s:${s.id}`,
    title: s.command_template.replace(/\s+/g, " "),
    subtitle: `${t("history.snippet")}: ${s.title}`,
  })),
]);

function ranker(list: PickerItem[], query: string): PickerItem[] {
  const ranked = rankHistory(
    list.map((i) => ({ item: i, ...(meta.value.get(i.id) ?? { text: i.title, use_count: 0, last_used_at: "" }) })),
    query,
  );
  return ranked.map((r) => r.item);
}

function select(id: string, withCtrl: boolean) {
  const [kind, ...rest] = id.split(":");
  const key = rest.join(":");
  const text =
    kind === "h"
      ? history.entries.find((e) => e.id === key)?.command
      : snippets.snippets.find((s) => s.id === key)?.command_template;
  if (text) emit("insert", text, withCtrl);
}
</script>

<template>
  <ListPicker
    :items="items"
    :ranker="ranker"
    :placeholder="t('history.placeholder')"
    :empty-text="t('history.empty')"
    @select="select"
    @close="emit('close')"
  />
</template>
