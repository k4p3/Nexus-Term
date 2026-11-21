<script setup lang="ts">
import BaseModal from "../common/BaseModal.vue";
import BaseButton from "../common/BaseButton.vue";
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CommandSnippet } from '../../types/snippets';
import { useSnippetsStore } from '../../stores/snippets.store';
import { X, Play, Terminal, Sparkles } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  snippet: CommandSnippet | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'execute', finalCommand: string): void;
}>();

const { t } = useI18n();
const snippetsStore = useSnippetsStore();

const paramValues = ref<Record<string, string>>({});
const paramsList = ref<string[]>([]);

watch(
  () => props.snippet,
  (item) => {
    if (item) {
      paramsList.value = snippetsStore.extractParameters(item.command_template);
      const initial: Record<string, string> = {};
      for (const p of paramsList.value) {
        initial[p] = '';
      }
      paramValues.value = initial;
    } else {
      paramsList.value = [];
      paramValues.value = {};
    }
  },
  { immediate: true }
);

function handleExecute() {
  if (!props.snippet) return;
  const finalCommand = snippetsStore.substituteParameters(
    props.snippet.command_template,
    paramValues.value
  );
  emit('execute', finalCommand);
  emit('close');
}
</script>

<template>
  <BaseModal v-if="isOpen && snippet" :title="snippet.title" size="sm" @close="emit('close')">
    <template #icon><Sparkles class="w-4 h-4" /></template>

    <form id="snippet-param-form" @submit.prevent="handleExecute" class="space-y-4">
        <div class="p-3 bg-app border border-line rounded-xl font-mono text-xs text-accent break-all select-all">
          {{ snippet.command_template }}
        </div>

        <div v-if="paramsList.length > 0" class="space-y-3">
          <p class="text-xs text-fg-muted font-medium">Ingresa los valores de los parámetros:</p>
          <div v-for="param in paramsList" :key="param">
            <label class="block text-[11px] font-mono text-accent mb-1">
              &#123;&#123; {{ param }} &#125;&#125;
            </label>
            <input
              v-model="paramValues[param]"
              type="text"
              :placeholder="`Valor para ${param}`"
              class="w-full px-3 py-1.5 bg-app border border-line rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent"
              autofocus
            />
          </div>
        </div>

        </form>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" variant="primary" form="snippet-param-form">
        <Play class="w-3.5 h-3.5 fill-current" />
            <span>Enviar a Terminal</span>
      </BaseButton>
    </template>
  </BaseModal>
</template>
