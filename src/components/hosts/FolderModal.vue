<script setup lang="ts">
import { ref, watch } from "vue";
import { useVaultStore } from "../../stores/vault.store";
import type { Folder } from "../../types/inventory";
import { X, Folder as FolderIcon } from "lucide-vue-next";

const props = defineProps<{
  isOpen: boolean;
  folderToEdit?: Folder | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved", id: string): void;
}>();

const vaultStore = useVaultStore();

const name = ref("");
const color = ref("#38bdf8");
const isSubmitting = ref(false);
const error = ref<string | null>(null);

const colorOptions = [
  "#38bdf8", // Sky
  "#34d399", // Emerald
  "#a78bfa", // Purple
  "#f472b6", // Pink
  "#fbbf24", // Amber
  "#f87171", // Red
  "#94a3b8", // Slate
];

watch(
  () => props.folderToEdit,
  (folder) => {
    if (folder) {
      name.value = folder.name;
      color.value = folder.color || "#38bdf8";
    } else {
      name.value = "";
      color.value = "#38bdf8";
    }
    error.value = null;
  },
  { immediate: true }
);

async function handleSave() {
  if (!name.value.trim()) {
    error.value = "El nombre de la carpeta es obligatorio.";
    return;
  }

  isSubmitting.value = true;
  error.value = null;

  try {
    const newId = await vaultStore.saveFolder({
      id: props.folderToEdit ? props.folderToEdit.id : "",
      parent_id: props.folderToEdit ? props.folderToEdit.parent_id : null,
      name: name.value.trim(),
      icon: "folder",
      color: color.value,
      sort_order: props.folderToEdit ? props.folderToEdit.sort_order : 0,
      updated_at: "",
    });
    emit("saved", newId);
    emit("close");
  } catch (err: any) {
    error.value = typeof err === "string" ? err : err?.message || "Error al guardar la carpeta.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-xs p-4">
    <div class="w-full max-w-sm bg-active900 border border-line800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      <div class="px-5 py-3.5 border-b border-line800 flex items-center justify-between bg-active950">
        <div class="flex items-center space-x-2">
          <FolderIcon class="w-5 h-5 text-accent" />
          <h3 class="text-sm font-bold text-fg">
            {{ folderToEdit ? 'Editar Carpeta' : 'Nueva Carpeta' }}
          </h3>
        </div>
        <button @click="emit('close')" class="text-fg400 hover:text-fg p-1 rounded-lg hover:bg-active800 transition">
          <X class="w-4 h-4" />
        </button>
      </div>

      <form @submit.prevent="handleSave" class="p-5 space-y-4">
        <div>
          <label class="block text-xs font-medium text-fg300 mb-1">Nombre de la Carpeta</label>
          <input
            v-model="name"
            type="text"
            required
            placeholder="ej. Producción / Clientes / Laboratorio"
            class="w-full px-3 py-2 bg-active950 border border-line700 rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-fg300 mb-1.5">Color de Distinción</label>
          <div class="flex items-center space-x-2">
            <button
              v-for="c in colorOptions"
              :key="c"
              type="button"
              @click="color = c"
              class="w-6 h-6 rounded-full transition-transform"
              :style="{ backgroundColor: c }"
              :class="{ 'ring-2 ring-fg ring-offset-2 ring-offset-surface scale-110': color === c }"
            ></button>
          </div>
        </div>

        <div v-if="error" class="p-3 bg-danger/40 border border-danger/60 rounded-xl text-xs text-danger">
          {{ error }}
        </div>

        <div class="pt-3 border-t border-line800 flex items-center justify-end space-x-2">
          <button
            type="button"
            @click="emit('close')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-medium text-fg400 hover:text-fg hover:bg-active800 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="px-4 py-1.5 bg-accent hover:bg-accent-hover text-on-accent font-semibold rounded-xl text-xs shadow-md shadow-accent/20 transition disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
