<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSnippetsStore, type SnippetOriginFilter } from '../../stores/snippets.store';
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
  CopyPlus,
  Check,
  Globe,
  User,
  Power,
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
  if (item.is_builtin) {
    if (confirm(`¿Deseas deshabilitar el snippet comunitario "${item.title}"? Podrás reactivarlo cuando quieras.`)) {
      await snippetsStore.toggleSnippetEnabled(item.id, false);
    }
  } else {
    if (confirm(`¿Eliminar permanentemente el snippet "${item.title}"?`)) {
      await snippetsStore.deleteSnippet(item.id);
    }
  }
}

async function handleToggleEnabled(item: CommandSnippet, enabled: boolean) {
  await snippetsStore.toggleSnippetEnabled(item.id, enabled);
}

async function handleDuplicate(item: CommandSnippet) {
  await snippetsStore.duplicateSnippet(item);
}

async function handleSave(payload: SaveSnippetPayload) {
  await snippetsStore.saveSnippet(payload);
}

function handleInsertSnippet(item: CommandSnippet) {
  if (!item.is_enabled) return;
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
      class="fixed inset-0 z-40 bg-overlay backdrop-blur-xs transition-opacity"
    ></div>

    <!-- Drawer Panel (Right slide-in) -->
    <aside
      :class="[
        'fixed top-0 right-0 z-40 h-full w-84 sm:w-[420px] bg-surface border-l border-line shadow-2xl flex flex-col transition-transform duration-200 ease-in-out text-fg',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ]"
    >
      <!-- Drawer Header -->
      <div class="p-4 border-b border-line flex items-center justify-between bg-header shrink-0">
        <div class="flex items-center gap-2">
          <div class="p-1.5 bg-app text-accent rounded-lg border border-line">
            <Code class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-fg leading-tight">Biblioteca de Snippets</h2>
            <p class="text-[10px] text-fg-muted">Comunitarios y personalizados</p>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <button
            @click="handleOpenNew"
            class="px-2 py-1 text-xs font-semibold text-on-accent bg-accent hover:brightness-110 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
            title="Nuevo Snippet"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>Crear</span>
          </button>
          <button
            @click="emit('close')"
            class="p-1.5 text-fg-muted hover:text-fg rounded-lg hover:bg-active transition-colors cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Filters & Tabs -->
      <div class="px-3 pt-3 pb-2 border-b border-line bg-app/30 shrink-0 space-y-2.5">
        <!-- Origin Tabs -->
        <div class="flex p-0.5 bg-app rounded-lg border border-line text-xs font-medium">
          <button
            @click="snippetsStore.originFilter = 'all'"
            :class="[
              'flex-1 py-1 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1 cursor-pointer',
              snippetsStore.originFilter === 'all'
                ? 'bg-surface text-accent shadow-xs'
                : 'text-fg-muted hover:text-fg',
            ]"
          >
            <span>Todos</span>
            <span class="text-[10px] px-1 py-0.2 rounded-full bg-active opacity-80">
              {{ snippetsStore.snippets.length }}
            </span>
          </button>

          <button
            @click="snippetsStore.originFilter = 'community'"
            :class="[
              'flex-1 py-1 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1 cursor-pointer',
              snippetsStore.originFilter === 'community'
                ? 'bg-surface text-accent shadow-xs'
                : 'text-fg-muted hover:text-fg',
            ]"
          >
            <Globe class="w-3 h-3 text-accent" />
            <span>Comunidad</span>
            <span class="text-[10px] px-1 py-0.2 rounded-full bg-active opacity-80">
              {{ snippetsStore.communitySnippets.length }}
            </span>
          </button>

          <button
            @click="snippetsStore.originFilter = 'custom'"
            :class="[
              'flex-1 py-1 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1 cursor-pointer',
              snippetsStore.originFilter === 'custom'
                ? 'bg-surface text-accent shadow-xs'
                : 'text-fg-muted hover:text-fg',
            ]"
          >
            <User class="w-3 h-3 text-info" />
            <span>Mis Snippets</span>
            <span class="text-[10px] px-1 py-0.2 rounded-full bg-active opacity-80">
              {{ snippetsStore.customSnippets.length }}
            </span>
          </button>
        </div>

        <!-- Search Input -->
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-fg-muted absolute left-2.5 top-2.5" />
          <input
            v-model="snippetsStore.searchQuery"
            type="text"
            placeholder="Buscar por comando, título o etiqueta..."
            class="w-full pl-8 pr-3 py-1.5 bg-app border border-line rounded-lg text-xs text-fg placeholder-fg-muted focus:outline-hidden focus:border-accent"
          />
        </div>

        <!-- Show Disabled Checkbox -->
        <div class="flex items-center justify-between text-[11px] text-fg-muted px-0.5">
          <label class="flex items-center gap-1.5 cursor-pointer hover:text-fg select-none">
            <input
              type="checkbox"
              v-model="snippetsStore.showDisabled"
              class="rounded border-line bg-app text-accent focus:ring-0 cursor-pointer w-3.5 h-3.5"
            />
            <span>Mostrar snippets deshabilitados</span>
          </label>
          <span class="text-[10px] opacity-75">
            {{ snippetsStore.filteredSnippets.length }} visibles
          </span>
        </div>
      </div>

      <!-- Snippets List -->
      <div class="flex-1 overflow-y-auto p-3 space-y-2.5">
        <div
          v-if="snippetsStore.filteredSnippets.length === 0"
          class="h-48 flex flex-col items-center justify-center text-center p-4"
        >
          <Code class="w-8 h-8 text-fg-muted mb-2" />
          <p class="text-xs text-fg-muted">No se encontraron snippets con el filtro seleccionado.</p>
          <button
            @click="handleOpenNew"
            class="mt-3 px-3 py-1 bg-active hover:bg-active text-fg text-xs rounded-lg transition-colors cursor-pointer"
          >
            + Crear nuevo snippet
          </button>
        </div>

        <div
          v-for="item in snippetsStore.filteredSnippets"
          :key="item.id"
          :class="[
            'group p-3 bg-app/70 border rounded-xl transition-all space-y-2 relative',
            item.is_enabled
              ? 'border-line hover:border-line'
              : 'border-line/40 opacity-60 bg-app/40',
          ]"
        >
          <!-- Top Row: Badge, Title & Actions -->
          <div class="flex items-start justify-between gap-2">
            <div class="space-y-0.5 min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <!-- Origin Badge -->
                <span
                  v-if="item.is_builtin"
                  class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-accent/80 text-accent border border-accent/60"
                  title="Snippet estándar de la comunidad"
                >
                  <Globe class="w-2.5 h-2.5" />
                  Comunidad
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-info/80 text-info border border-info/60"
                >
                  <User class="w-2.5 h-2.5" />
                  Personal
                </span>

                <span
                  v-if="!item.is_enabled"
                  class="px-1.5 py-0.2 rounded text-[9px] font-medium bg-active text-fg-muted"
                >
                  Deshabilitado
                </span>

                <h4 class="text-xs font-semibold text-fg truncate">{{ item.title }}</h4>
              </div>

              <p v-if="item.description" class="text-[11px] text-fg-muted line-clamp-1">
                {{ item.description }}
              </p>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-1 shrink-0">
              <!-- Enable / Disable Switch -->
              <button
                @click="handleToggleEnabled(item, !item.is_enabled)"
                :class="[
                  'p-1 rounded transition-colors cursor-pointer',
                  item.is_enabled
                    ? 'text-success hover:bg-success/40'
                    : 'text-fg-muted hover:text-fg hover:bg-active',
                ]"
                :title="item.is_enabled ? 'Deshabilitar snippet' : 'Habilitar snippet'"
              >
                <Power class="w-3.5 h-3.5" />
              </button>

              <!-- Duplicate Button -->
              <button
                @click="handleDuplicate(item)"
                class="p-1 text-fg-muted hover:text-accent rounded hover:bg-active transition-colors cursor-pointer"
                title="Duplicar como snippet personal"
              >
                <CopyPlus class="w-3.5 h-3.5" />
              </button>

              <!-- Copy Command -->
              <button
                @click="handleCopy(item)"
                class="p-1 text-fg-muted hover:text-fg rounded hover:bg-active transition-colors cursor-pointer"
                :title="copiedSnippetId === item.id ? '¡Copiado!' : 'Copiar comando'"
              >
                <Check v-if="copiedSnippetId === item.id" class="w-3.5 h-3.5 text-success" />
                <Copy v-else class="w-3.5 h-3.5" />
              </button>

              <!-- Edit (only for custom or allows editing) -->
              <button
                v-if="!item.is_builtin"
                @click="handleEdit(item)"
                class="p-1 text-fg-muted hover:text-fg rounded hover:bg-active transition-colors cursor-pointer"
                title="Editar"
              >
                <Edit2 class="w-3.5 h-3.5" />
              </button>

              <!-- Delete / Disable -->
              <button
                @click="handleDelete(item)"
                class="p-1 text-fg-muted hover:text-danger rounded hover:bg-active transition-colors cursor-pointer"
                :title="item.is_builtin ? 'Deshabilitar snippet comunitario' : 'Eliminar snippet personal'"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Code Box -->
          <div
            @click="handleInsertSnippet(item)"
            :class="[
              'p-2 bg-surface border rounded-lg font-mono text-[11px] break-all flex items-center justify-between gap-2 transition-all',
              item.is_enabled
                ? 'text-accent border-line/80 cursor-pointer hover:border-accent/50 hover:bg-surface/90 group/code'
                : 'text-fg-muted border-line/40 cursor-not-allowed opacity-75',
            ]"
            :title="item.is_enabled ? 'Hacer clic para insertar en la terminal' : 'Snippet deshabilitado (actívalo para usarlo)'"
          >
            <span class="truncate">{{ item.command_template }}</span>
            <div
              v-if="item.is_enabled"
              class="p-1 rounded bg-active group-hover/code:bg-accent group-hover/code:text-on-accent text-fg-muted shrink-0 transition-colors"
            >
              <Play class="w-3 h-3 fill-current" />
            </div>
          </div>

          <!-- Tags -->
          <div v-if="item.tags.length > 0" class="flex flex-wrap gap-1">
            <span
              v-for="t in item.tags"
              :key="t"
              class="px-1.5 py-0.2 bg-surface border border-line rounded text-[10px] text-fg-muted"
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
