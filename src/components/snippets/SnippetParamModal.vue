<script setup lang="ts">
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
  <div
    v-if="isOpen && snippet"
    @click.self="emit('close')"
    class="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-xs p-4"
  >
    <div
      class="bg-surface border border-line/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-fg"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-line bg-app/40">
        <div class="flex items-center gap-2 truncate">
          <div class="p-1.5 bg-accent/20 text-accent rounded-lg shrink-0">
            <Sparkles class="w-4 h-4" />
          </div>
          <h3 class="text-sm font-semibold text-fg truncate">
            {{ snippet.title }}
          </h3>
        </div>
        <button
          @click="emit('close')"
          class="p-1 text-fg-muted hover:text-fg rounded-lg hover:bg-active transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Parameters inputs -->
      <form @submit.prevent="handleExecute" class="p-5 space-y-4">
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

        <!-- Footer -->
        <div class="pt-3 border-t border-line flex items-center justify-end gap-2">
          <button
            type="button"
            @click="emit('close')"
            class="px-3 py-1.5 text-xs text-fg-muted hover:text-fg rounded-lg transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="submit"
            class="inline-flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent-hover text-on-accent font-semibold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Play class="w-3.5 h-3.5 fill-current" />
            <span>Enviar a Terminal</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
