<script setup lang="ts">
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
    error.value = 'El título es obligatorio / Title is required.';
    return;
  }
  if (!commandTemplate.value.trim()) {
    error.value = 'El comando es obligatorio / Command template is required.';
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
  <div
    v-if="isOpen"
    @click.self="emit('close')"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
  >
    <div
      class="bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-neutral-100"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-950/40">
        <div class="flex items-center gap-2">
          <div class="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
            <Code class="w-4 h-4" />
          </div>
          <h3 class="text-sm font-semibold text-white">
            {{ snippetToEdit ? 'Editar Snippet' : 'Nuevo Snippet de Comando' }}
          </h3>
        </div>
        <button
          @click="emit('close')"
          class="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body Form -->
      <form @submit.prevent="handleSubmit" class="p-5 space-y-4">
        <div>
          <label class="block text-xs font-medium text-neutral-300 mb-1">Título</label>
          <input
            v-model="title"
            type="text"
            placeholder="ej. Docker Follow Logs"
            class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-xs font-medium text-neutral-300">Plantilla de Comando</label>
            <span class="text-[11px] text-blue-400 flex items-center gap-1">
              <Sparkles class="w-3 h-3" />
              <span v-pre>Soporta &#123;&#123;parametro&#125;&#125;</span>
            </span>
          </div>
          <textarea
            v-model="commandTemplate"
            rows="3"
            placeholder="docker logs -f --tail {{lines}} {{container}}"
            class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-hidden focus:border-blue-500"
          ></textarea>
        </div>

        <div>
          <label class="block text-xs font-medium text-neutral-300 mb-1">Descripción (Opcional)</label>
          <input
            v-model="description"
            type="text"
            placeholder="Seguir los logs de un contenedor con líneas variables"
            class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-neutral-300 mb-1">Etiquetas (separadas por coma)</label>
          <input
            v-model="tagsInput"
            type="text"
            placeholder="docker, logs, devops"
            class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div v-if="error" class="text-xs text-rose-400">{{ error }}</div>

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
            class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {{ t('common.save') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
