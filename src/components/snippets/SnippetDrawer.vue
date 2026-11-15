<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSnippetsStore } from '../../stores/snippets.store';
import type { CommandSnippet, SaveSnippetPayload } from '../../types/snippets';
import SnippetModal from './SnippetModal.vue';
import SnippetParamModal from './SnippetParamModal.vue';
import {
  X,
  Plus,
  Search,
  Code,
  Play,
  Edit2,
  Trash2,
  Tag,
  Copy,
  Check,
} from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'insert-command', command: string): void;
}>();

const { t } = useI18n();
const snippetsStore = useSnippetsStore();

const isModalOpen = ref(false);
const snippetToEdit = ref<CommandSnippet | null>(null);

const isParamModalOpen = ref(false);
const snippetForParam = ref<CommandSnippet | null>(null);

const copiedSnippetId = ref<string | null>(null);

onMounted(async () => {
  await snippetsStore.fetchSnippets();
});

function handleOpenNew() {
  snippetToEdit.value = null;
  isModalOpen.value = true;
}

function handleEdit(item: CommandSnippet) {
  snippetToEdit.value = item;
  isModalOpen.value = true;
}

async function handleDelete(item: CommandSnippet) {
  if (confirm(`¿Eliminar el snippet "${item.title}"?`)) {
    await snippetsStore.deleteSnippet(item.id);
  }
}

async function handleSave(payload: SaveSnippetPayload) {
  await snippetsStore.saveSnippet(payload);
}

function handleInsertSnippet(item: CommandSnippet) {
  const params = snippetsStore.extractParameters(item.command_template);
  if (params.length > 0) {
    snippetForParam.value = item;
    isParamModalOpen.value = true;
  } else {
    emit('insert-command', item.command_template + '\n');
    emit('close');
  }
}

function handleParamExecute(finalCommand: string) {
  emit('insert-command', finalCommand + '\n');
  emit('close');
}

function handleCopy(item: CommandSnippet) {
  navigator.clipboard.writeText(item.command_template);
  copiedSnippetId.value = item.id;
  setTimeout(() => {
    copiedSnippetId.value = null;
  }, 2000);
}
</script>

<template>
  <div>
    <!-- Drawer Overlay -->
    <div
      v-if="isOpen"
      @click="emit('close')"
      class="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity"
    ></div>

    <!-- Drawer Panel (Right slide-in) -->
    <aside
      :class="[
        'fixed top-0 right-0 z-40 h-full w-80 sm:w-96 bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col transition-transform duration-200 ease-in-out',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ]"
    >
      <!-- Drawer Header -->
      <div class="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60 shrink-0">
        <div class="flex items-center gap-2">
          <div class="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
            <Code class="w-4 h-4" />
          </div>
          <h2 class="text-sm font-semibold text-white">Snippets</h2>
          <span class="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 font-mono">
            {{ snippetsStore.snippets.length }}
          </span>
        </div>

        <div class="flex items-center gap-1">
          <button
            @click="handleOpenNew"
            class="p-1.5 text-neutral-300 hover:text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer"
            title="Nuevo Snippet"
          >
            <Plus class="w-4 h-4" />
          </button>
          <button
            @click="emit('close')"
            class="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Search Input -->
      <div class="p-3 border-b border-neutral-800 bg-neutral-950/20 shrink-0">
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
          <input
            v-model="snippetsStore.searchQuery"
            type="text"
            placeholder="Buscar por comando, título o tag..."
            class="w-full pl-8 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      <!-- Snippets List -->
      <div class="flex-1 overflow-y-auto p-3 space-y-2.5">
        <div
          v-if="snippetsStore.filteredSnippets.length === 0"
          class="h-48 flex flex-col items-center justify-center text-center p-4"
        >
          <Code class="w-8 h-8 text-neutral-600 mb-2" />
          <p class="text-xs text-neutral-400">No hay snippets guardados.</p>
          <button
            @click="handleOpenNew"
            class="mt-3 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded-lg transition-colors"
          >
            + Crear primer snippet
          </button>
        </div>

        <div
          v-for="item in snippetsStore.filteredSnippets"
          :key="item.id"
          class="group p-3 bg-neutral-950/70 border border-neutral-800 hover:border-neutral-700 rounded-xl transition-all space-y-2"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <h4 class="text-xs font-semibold text-neutral-200 truncate">{{ item.title }}</h4>
              <p v-if="item.description" class="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                {{ item.description }}
              </p>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                @click="handleCopy(item)"
                class="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
                :title="copiedSnippetId === item.id ? '¡Copiado!' : 'Copiar comando'"
              >
                <Check v-if="copiedSnippetId === item.id" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5" />
              </button>
              <button
                @click="handleEdit(item)"
                class="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
                title="Editar"
              >
                <Edit2 class="w-3.5 h-3.5" />
              </button>
              <button
                @click="handleDelete(item)"
                class="p-1 text-neutral-400 hover:text-rose-400 rounded hover:bg-neutral-800 transition-colors"
                title="Eliminar"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Code Box -->
          <div
            @click="handleInsertSnippet(item)"
            class="p-2 bg-neutral-900 border border-neutral-800/80 rounded-lg font-mono text-[11px] text-cyan-300 break-all cursor-pointer hover:border-cyan-500/50 hover:bg-neutral-900/90 transition-all flex items-center justify-between gap-2 group/code"
          >
            <span class="truncate">{{ item.command_template }}</span>
            <div class="p-1 rounded bg-neutral-800 group-hover/code:bg-cyan-500 group-hover/code:text-slate-950 text-neutral-400 shrink-0 transition-colors">
              <Play class="w-3 h-3 fill-current" />
            </div>
          </div>

          <!-- Tags -->
          <div v-if="item.tags.length > 0" class="flex flex-wrap gap-1">
            <span
              v-for="t in item.tags"
              :key="t"
              class="px-1.5 py-0.2 bg-neutral-900 border border-neutral-800 rounded text-[10px] text-neutral-400"
            >
              #{{ t }}
            </span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Modal to Create / Edit Snippet -->
    <SnippetModal
      :is-open="isModalOpen"
      :snippet-to-edit="snippetToEdit"
      @close="isModalOpen = false"
      @save="handleSave"
    />

    <!-- Modal to fill parameters before execution -->
    <SnippetParamModal
      :is-open="isParamModalOpen"
      :snippet="snippetForParam"
      @close="isParamModalOpen = false"
      @execute="handleParamExecute"
    />
  </div>
</template>
