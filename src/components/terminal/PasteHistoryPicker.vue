<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import ListPicker, { type PickerItem } from "../common/ListPicker.vue";
import { usePasteHistoryStore } from "../../stores/paste-history.store";
import { maskedPreview } from "../../utils/paste-guard";

const emit = defineEmits<{ (e: "paste", text: string): void; (e: "close"): void }>();
const { t } = useI18n();
const history = usePasteHistoryStore();

const items = computed<PickerItem[]>(() =>
  history.entries.map((e) => {
    const flat = maskedPreview(e.text).replace(/\s+/g, " ").trim();
    return { id: String(e.id), title: flat.length > 90 ? flat.slice(0, 90) + "…" : flat };
  }),
);

function select(id: string) {
  const entry = history.entries.find((e) => String(e.id) === id);
  if (entry) emit("paste", entry.text);
}
</script>

<template>
  <ListPicker
    :items="items"
    :placeholder="t('paste.historyPlaceholder')"
    :empty-text="t('paste.historyEmpty')"
    @select="select"
    @close="emit('close')"
  />
</template>
