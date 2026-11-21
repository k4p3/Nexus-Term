<script setup lang="ts">
import BaseModal from "../common/BaseModal.vue";
import BaseButton from "../common/BaseButton.vue";
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CommandSnippet, SaveSnippetPayload } from '../../types/snippets';
import { X, Code, Tag, AlignLeft, Sparkles } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  snippetToEdit?: CommandSnippet | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: SaveSnippetPayload): void;
}>();

const { t } = useI18n();
const PARAM_TOKEN = "{{param}}"; // literal shown to the user; kept out of the template to avoid mustache parsing

const title = ref('');
const commandTemplate = ref('');
const description = ref('');
const tagsInput = ref('');
const error = ref('');

watch(
  () => props.snippetToEdit,
  (item) => {
    if (item) {
      title.value = item.title;
      commandTemplate.value = item.command_template;
      description.value = item.description || '';
      tagsInput.value = item.tags.join(', ');
    } else {
      title.value = '';
      commandTemplate.value = '';
      description.value = '';
      tagsInput.value = '';
    }
    error.value = '';
  },
  { immediate: true }
);

function handleSubmit() {
  if (!title.value.trim()) {
    error.value = t('ui.snipForm.titleRequired');
    return;
  }
  if (!commandTemplate.value.trim()) {
    error.value = t('ui.snipForm.commandRequired');
    return;
  }

  const tags = tagsInput.value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  emit('save', {
    id: props.snippetToEdit?.id,
    title: title.value.trim(),
    command_template: commandTemplate.value.trim(),
    description: description.value.trim() || null,
    tags,
  });
  emit('close');
}
</script>

<template>
  <BaseModal v-if="isOpen" :title="snippetToEdit ? t('ui.snipForm.edit') : t('ui.snipForm.new')" size="md" @close="emit('close')">
    <template #icon><Code class="w-4 h-4" /></template>

    <form id="snippet-form" @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-fg mb-1">{{ t('ui.snipForm.title') }}</label>
          <input
            v-model="title"
            type="text"
            :placeholder="t('ui.snipForm.titlePlaceholder')"
            class="w-full px-3 py-2 bg-app border border-line rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-xs font-medium text-fg">{{ t('ui.snipForm.template') }}</label>
            <span class="text-[11px] text-accent flex items-center gap-1">
              <Sparkles class="w-3 h-3" />
              <span>{{ t('ui.snipForm.supports', { token: PARAM_TOKEN }) }}</span>
            </span>
          </div>
          <textarea
            v-model="commandTemplate"
            rows="3"
            placeholder="docker logs -f --tail {{lines}} {{container}}"
            class="w-full px-3 py-2 bg-app border border-line rounded-lg text-xs font-mono text-accent focus:outline-hidden focus:border-accent"
          ></textarea>
        </div>

        <div>
          <label class="block text-xs font-medium text-fg mb-1">{{ t('ui.snipForm.description') }}</label>
          <input
            v-model="description"
            type="text"
            :placeholder="t('ui.snipForm.descPlaceholder')"
            class="w-full px-3 py-2 bg-app border border-line rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-fg mb-1">{{ t('ui.host.tags') }}</label>
          <input
            v-model="tagsInput"
            type="text"
            placeholder="docker, logs, devops"
            class="w-full px-3 py-2 bg-app border border-line rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent"
          />
        </div>

        <div v-if="error" class="text-xs text-danger">{{ error }}</div>

        </form>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" variant="primary" form="snippet-form">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
