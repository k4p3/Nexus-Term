<script setup lang="ts">
import { ref, watch } from "vue";
import { useVaultStore } from "../../stores/vault.store";
import type { Folder } from "../../types/inventory";
import { Folder as FolderIcon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import BaseModal from "../common/BaseModal.vue";
import BaseButton from "../common/BaseButton.vue";

const props = defineProps<{
  isOpen: boolean;
  folderToEdit?: Folder | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved", id: string): void;
}>();

const { t } = useI18n();
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
  <BaseModal
    v-if="isOpen"
    :title="folderToEdit ? 'Editar Carpeta' : 'Nueva Carpeta'"
    size="sm"
    @close="emit('close')"
  >
    <template #icon><FolderIcon class="w-4 h-4" /></template>

    <form id="folder-form" @submit.prevent="handleSave" class="space-y-4">
      <div>
        <label for="folder-name" class="block text-xs font-medium text-fg mb-1.5">Nombre de la Carpeta</label>
        <input
          id="folder-name"
          v-model="name"
          type="text"
          required
          placeholder="ej. Producción / Clientes / Laboratorio"
          class="w-full h-9 px-3 bg-app border border-line rounded-control text-sm text-fg placeholder-fg-muted focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent transition"
        />
      </div>

      <fieldset>
        <legend class="block text-xs font-medium text-fg mb-1.5">Color de Distinción</legend>
        <div class="flex items-center gap-2">
          <button
            v-for="c in colorOptions"
            :key="c"
            type="button"
            :aria-label="c"
            :aria-pressed="color === c"
            @click="color = c"
            class="w-6 h-6 rounded-full transition-transform cursor-pointer"
            :style="{ backgroundColor: c }"
            :class="{ 'ring-2 ring-fg ring-offset-2 ring-offset-surface scale-110': color === c }"
          ></button>
        </div>
      </fieldset>

      <div v-if="error" role="alert" class="p-3 bg-danger/10 border border-danger/30 rounded-control text-xs text-danger">
        {{ error }}
      </div>
    </form>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" variant="primary" :loading="isSubmitting" form="folder-form">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseModal>
</template>
