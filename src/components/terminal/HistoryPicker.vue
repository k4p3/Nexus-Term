<script setup lang="ts">
import { useSnippetText } from "../../composables/useSnippetText";
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import ListPicker, { type PickerItem } from "../common/ListPicker.vue";
import { useHistoryStore } from "../../stores/history.store";
import { useSnippetsStore } from "../../stores/snippets.store";
import { toCandidates, rankCandidates, type Candidate } from "../../utils/completion-candidates";

const props = defineProps<{ hostId: string | null | undefined }>();
const emit = defineEmits<{
  (e: "insert", text: string, execute: boolean): void;
  (e: "close"): void;
}>();

const { t } = useI18n();
const { snippetTitle, snippetDescription } = useSnippetText();
const history = useHistoryStore();
const snippets = useSnippetsStore();

onMounted(async () => {
  await history.load(props.hostId);
  if (snippets.snippets.length === 0) await snippets.fetchSnippets();
});

const candidates = computed(() => toCandidates(history.entries, snippets.enabledSnippets, true));
const byId = computed(() => new Map(candidates.value.map((c) => [c.id, c])));

const items = computed<PickerItem[]>(() =>
  candidates.value.map((c) => {
    const title = c.text.replace(/\s+/g, " ");
    if (c.kind === "snippet") {
      const sn = snippets.enabledSnippets.find((x) => x.id === c.snippetId);
      return { id: c.id, title, subtitle: `${t("history.snippet")}: ${sn ? snippetTitle(sn) : ""}` };
    }
    return {
      id: c.id,
      title,
      subtitle: c.exitCode !== null && c.exitCode !== 0 ? `✗ ${c.exitCode}` : undefined,
      hint: c.useCount > 1 ? `×${c.useCount}` : undefined,
    };
  }),
);

function ranker(list: PickerItem[], query: string): PickerItem[] {
  const ranked = rankCandidates(
    list.map((i) => byId.value.get(i.id)).filter((c): c is Candidate => !!c),
    query,
  );
  const items = new Map(list.map((i) => [i.id, i]));
  return ranked.map((c) => items.get(c.id)).filter((i): i is PickerItem => !!i);
}

function select(id: string, withCtrl: boolean) {
  const text = byId.value.get(id)?.text;
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
