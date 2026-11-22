<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import BaseModal from "../common/BaseModal.vue";
import BaseButton from "../common/BaseButton.vue";
import { Upload, AlertTriangle } from "lucide-vue-next";
import { useSnippetsStore } from "../../stores/snippets.store";
import { useUiStore } from "../../stores/ui.store";
import { parseSnippetFile, toSavePayload, MAX_FILE_BYTES, type ParseResult } from "../../utils/snippet-io";

const emit = defineEmits<{ (e: "close"): void }>();

const { t } = useI18n();
const snippets = useSnippetsStore();
const ui = useUiStore();

const result = ref<ParseResult | null>(null);
const fileName = ref("");
const busy = ref(false);

const summary = computed(() => (result.value?.ok ? result.value : null));
const hasWarnings = computed(() => !!summary.value?.toImport.some((i) => i.warnings.length));

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  fileName.value = file.name;
  if (file.size > MAX_FILE_BYTES) {
    result.value = { ok: false, error: "tooLarge" };
    return;
  }
  result.value = parseSnippetFile(await file.text(), snippets.snippets);
}

async function confirmImport() {
  if (!summary.value || busy.value || summary.value.toImport.length === 0) return;
  busy.value = true;
  try {
    const { created, failed } = await snippets.importSnippets(summary.value.toImport.map(toSavePayload));
    ui.pushToast(t("snippetsIo.done", { created, failed }), { kind: failed ? "warning" : "success" });
    emit("close");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <BaseModal :title="t('snippetsIo.importTitle')" size="lg" @close="emit('close')">
    <template #icon><Upload class="w-4 h-4" /></template>

    <div class="space-y-3 text-xs">
      <p class="text-fg-muted">{{ t("snippetsIo.intro") }}</p>
      <label class="inline-block">
        <input type="file" accept=".json,application/json" class="hidden" data-testid="file" @change="onFile" />
        <span class="px-3 py-1.5 rounded-lg border border-line bg-app hover:border-accent cursor-pointer text-fg">
          {{ fileName || t("snippetsIo.choose") }}
        </span>
      </label>

      <p v-if="result && !result.ok" class="text-danger" data-testid="error">{{ t(`snippetsIo.error.${result.error}`) }}</p>

      <template v-if="summary">
        <p class="font-medium text-fg" data-testid="counts">
          {{ t("snippetsIo.counts", { n: summary.toImport.length, s: summary.skipped.length, i: summary.invalid.length }) }}
        </p>

        <div v-if="hasWarnings" class="flex items-start gap-2 p-2 rounded-lg bg-warning/10 border border-warning/30 text-warning">
          <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ t("snippetsIo.riskNotice") }}</span>
        </div>

        <ul v-if="summary.toImport.length" class="space-y-1.5 max-h-64 overflow-y-auto" data-testid="list">
          <li v-for="(item, i) in summary.toImport" :key="i" class="p-2 rounded-lg bg-app border border-line">
            <div class="font-semibold text-fg truncate">{{ item.title }}</div>
            <div class="font-mono text-[11px] text-accent break-all">{{ item.command }}</div>
            <div v-if="item.warnings.length" class="mt-1 text-warning flex items-center gap-1" data-testid="warn">
              <AlertTriangle class="w-3 h-3" /> {{ t("snippetsIo.risky", { list: item.warnings.join(", ") }) }}
            </div>
          </li>
        </ul>

        <ul v-if="summary.skipped.length || summary.invalid.length" class="space-y-1 text-fg-muted max-h-32 overflow-y-auto">
          <li v-for="s in summary.skipped" :key="'s' + s.index">#{{ s.index + 1 }} «{{ s.title }}»: {{ t(`snippetsIo.skip.${s.reason}`) }}</li>
          <li v-for="v in summary.invalid" :key="'i' + v.index">#{{ v.index + 1 }}: {{ t(`snippetsIo.invalid.${v.reason}`) }}</li>
        </ul>
      </template>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">{{ t("common.cancel") }}</BaseButton>
      <BaseButton variant="primary" :disabled="!summary || !summary.toImport.length || busy" data-testid="confirm" @click="confirmImport">
        {{ t("snippetsIo.import") }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
