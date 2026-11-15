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
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
  >
    <div
      class="bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-neutral-100"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-950/40">
        <div class="flex items-center gap-2 truncate">
          <div class="p-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg shrink-0">
            <Sparkles class="w-4 h-4" />
          </div>
          <h3 class="text-sm font-semibold text-white truncate">
            {{ snippet.title }}
          </h3>
        </div>
        <button
          @click="emit('close')"
          class="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Parameters inputs -->
      <form @submit.prevent="handleExecute" class="p-5 space-y-4">
        <div class="p-3 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-xs text-cyan-300 break-all select-all">
          {{ snippet.command_template }}
        </div>

        <div v-if="paramsList.length > 0" class="space-y-3">
          <p class="text-xs text-neutral-400 font-medium">Ingresa los valores de los parámetros:</p>
          <div v-for="param in paramsList" :key="param">
            <label class="block text-[11px] font-mono text-blue-400 mb-1">
              &#123;&#123; {{ param }} &#125;&#125;
            </label>
            <input
              v-model="paramValues[param]"
              type="text"
              :placeholder="`Valor para ${param}`"
              class="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-cyan-500"
              autofocus
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
          <button
            type="button"
            @click="emit('close')"
            class="px-3 py-1.5 text-xs text-neutral-400 hover:text-white rounded-lg transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="submit"
            class="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Play class="w-3.5 h-3.5 fill-current" />
            <span>Enviar a Terminal</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
