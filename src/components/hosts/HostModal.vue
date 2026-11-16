<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useVaultStore } from "../../stores/vault.store";
import type { HostSummary, SaveHostPayload } from "../../types/inventory";
import FolderModal from "./FolderModal.vue";
import IdentityModal from "./IdentityModal.vue";
import { X, Server, Globe, Tag, Plus, KeyRound, Route } from "lucide-vue-next";

const props = defineProps<{
  isOpen: boolean;
  hostToEdit?: HostSummary | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const vaultStore = useVaultStore();

const label = ref("");
const hostname = ref("");
const port = ref(22);
const folderId = ref<string | null>(null);
const identityId = ref<string | null>(null);
const jumpHostId = ref<string | null>(null);
const selectedIdentity = computed(() => vaultStore.identities.find((i) => i.id === identityId.value));
const availableJumpHosts = computed(() =>
  vaultStore.hosts.filter((h) => !props.hostToEdit || h.id !== props.hostToEdit.id)
);
const usernameOverride = ref("");
const tagsInput = ref("");
const notes = ref("");
const isSubmitting = ref(false);
const error = ref<string | null>(null);

// Nested modals state
const isNewFolderModalOpen = ref(false);
const isNewIdentityModalOpen = ref(false);

function handleFolderCreated(newId: string) {
  folderId.value = newId;
  isNewFolderModalOpen.value = false;
}

function handleIdentityCreated(newId: string) {
  identityId.value = newId;
  isNewIdentityModalOpen.value = false;
}

watch(
  () => props.hostToEdit,
  (host) => {
    if (host) {
      label.value = host.label;
      hostname.value = host.hostname;
      port.value = host.port;
      folderId.value = host.folder_id;
      identityId.value = host.identity_id;
      jumpHostId.value = host.jump_host_id || null;
      usernameOverride.value = host.username_override || "";
      tagsInput.value = host.tags ? host.tags.join(", ") : "";
      notes.value = host.notes || "";
    } else {
      label.value = "";
      hostname.value = "";
      port.value = 22;
      folderId.value = null;
      identityId.value = vaultStore.identities.length > 0 ? vaultStore.identities[0].id : null;
      jumpHostId.value = null;
      usernameOverride.value = "";
      tagsInput.value = "";
      notes.value = "";
    }
    error.value = null;
  },
  { immediate: true }
);

async function handleSave() {
  if (!label.value.trim() || !hostname.value.trim()) {
    error.value = "Etiqueta y dirección (Host/IP) son obligatorios.";
    return;
  }

  isSubmitting.value = true;
  error.value = null;

  try {
    const tags = tagsInput.value
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const payload: SaveHostPayload = {
      id: props.hostToEdit?.id,
      label: label.value.trim(),
      hostname: hostname.value.trim(),
      port: Number(port.value) || 22,
      folder_id: folderId.value || null,
      identity_id: identityId.value || null,
      jump_host_id: jumpHostId.value || null,
      username_override: usernameOverride.value.trim() ? usernameOverride.value.trim() : null,
      tags,
      notes: notes.value.trim() ? notes.value.trim() : null,
    };

    await vaultStore.saveHost(payload);
    emit("close");
  } catch (err: any) {
    error.value = typeof err === "string" ? err : err?.message || "Error al guardar el servidor.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
    <div class="w-full max-w-lg bg-theme-surface border border-theme rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-theme-main transition-colors">
      <!-- Header -->
      <div class="px-5 py-3.5 border-b border-theme flex items-center justify-between bg-theme-header">
        <div class="flex items-center space-x-2">
          <Server class="w-5 h-5 text-theme-accent" />
          <h3 class="text-sm font-bold text-theme-main">
            {{ hostToEdit ? 'Editar Servidor SSH' : 'Nuevo Servidor SSH' }}
          </h3>
        </div>
        <button @click="emit('close')" class="text-theme-muted hover:text-theme-main p-1 rounded-lg hover:bg-theme-active transition cursor-pointer">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSave" class="p-5 space-y-4 overflow-y-auto flex-1">
        <div>
          <label class="block text-xs font-medium text-theme-muted mb-1">Nombre / Alias del Servidor</label>
          <input
            v-model="label"
            type="text"
            required
            placeholder="ej. Web Server Producción / VPS Hetzner"
            class="w-full px-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main placeholder-theme-muted focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
          />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label class="block text-xs font-medium text-theme-muted mb-1">Dirección IP o Hostname</label>
            <div class="relative">
              <Globe class="w-4 h-4 text-theme-muted absolute left-3 top-2.5" />
              <input
                v-model="hostname"
                type="text"
                required
                placeholder="192.168.1.100 o app.ejemplo.com"
                class="w-full pl-9 pr-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main placeholder-theme-muted focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-theme-muted mb-1">Puerto SSH</label>
            <input
              v-model="port"
              type="number"
              min="1"
              max="65535"
              required
              class="w-full px-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-medium text-theme-muted">Carpeta</label>
              <button
                type="button"
                @click="isNewFolderModalOpen = true"
                class="text-[11px] text-theme-accent hover:underline flex items-center space-x-0.5 cursor-pointer"
              >
                <Plus class="w-3 h-3" />
                <span>Nueva</span>
              </button>
            </div>
            <select
              v-model="folderId"
              class="w-full px-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
            >
              <option :value="null">Sin carpeta (Raíz)</option>
              <option v-for="folder in vaultStore.folders" :key="folder.id" :value="folder.id">
                📁 {{ folder.name }}
              </option>
            </select>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-medium text-theme-muted">Credencial / Identidad</label>
              <button
                type="button"
                @click="isNewIdentityModalOpen = true"
                class="text-[11px] text-theme-accent hover:underline flex items-center space-x-0.5 cursor-pointer"
              >
                <Plus class="w-3 h-3" />
                <span>Nueva</span>
              </button>
            </div>
            <select
              v-model="identityId"
              class="w-full px-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
            >
              <option :value="null">Sin credencial vinculada</option>
              <option v-for="id in vaultStore.identities" :key="id.id" :value="id.id">
                {{ id.auth_type === 'agent' ? '🛡️' : id.auth_type === 'password' ? '🔒' : '🔑' }} {{ id.name }} ({{ id.username }} • {{ id.auth_type === 'password' ? 'Password' : id.auth_type === 'agent' ? 'SSH-Agent' : (id.public_key?.startsWith('ssh-ed25519') ? 'Ed25519' : id.public_key?.startsWith('ssh-rsa') ? 'RSA' : 'Key') }})
              </option>
            </select>
            <div v-if="selectedIdentity?.public_key" class="mt-1 text-[10px] font-mono text-theme-muted truncate" :title="selectedIdentity.public_key">
              🔑 {{ selectedIdentity.public_key.slice(0, 36) }}...
            </div>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-theme-muted mb-1 flex items-center space-x-1.5">
            <Route class="w-3.5 h-3.5 text-theme-accent" />
            <span>Servidor de Salto / Bastion (Opcional)</span>
          </label>
          <select
            v-model="jumpHostId"
            class="w-full px-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
          >
            <option :value="null">Conexión directa (Sin Servidor de Salto)</option>
            <option
              v-for="jHost in availableJumpHosts"
              :key="jHost.id"
              :value="jHost.id"
            >
              🌐 {{ jHost.label }} ({{ jHost.hostname }}:{{ jHost.port }})
            </option>
          </select>
          <p class="mt-1 text-[11px] text-theme-muted">
            Si se especifica, NexusTerm tunelizará la conexión SSH a través de este Bastion usando direct-tcpip.
          </p>
        </div>

        <div>
          <label class="block text-xs font-medium text-theme-muted mb-1">
            Sobrescribir Usuario (Opcional)
          </label>
          <input
            v-model="usernameOverride"
            type="text"
            placeholder="Si difiere del usuario de la credencial"
            class="w-full px-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main placeholder-theme-muted focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-theme-muted mb-1">Etiquetas (separadas por coma)</label>
          <div class="relative">
            <Tag class="w-4 h-4 text-theme-muted absolute left-3 top-2.5" />
            <input
              v-model="tagsInput"
              type="text"
              placeholder="produccion, linux, nginx, aws"
              class="w-full pl-9 pr-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main placeholder-theme-muted focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-theme-muted mb-1">Notas Cifradas (Opcional)</label>
          <div class="relative">
            <textarea
              v-model="notes"
              rows="2"
              placeholder="Notas protegidas por la bóveda..."
              class="w-full px-3 py-2 bg-theme-input border border-theme rounded-xl text-xs text-theme-main placeholder-theme-muted focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
            ></textarea>
          </div>
        </div>

        <div v-if="error" class="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
          {{ error }}
        </div>

        <!-- Actions -->
        <div class="pt-3 border-t border-theme flex items-center justify-end space-x-2">
          <button
            type="button"
            @click="emit('close')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-medium text-theme-muted hover:text-theme-main hover:bg-theme-active transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="px-4 py-1.5 bg-theme-accent hover:brightness-110 text-slate-950 font-semibold rounded-xl text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            Guardar Servidor
          </button>
        </div>
      </form>
    </div>

    <!-- Nested Creation Modals -->
    <FolderModal
      :is-open="isNewFolderModalOpen"
      @close="isNewFolderModalOpen = false"
      @saved="handleFolderCreated"
    />

    <IdentityModal
      :is-open="isNewIdentityModalOpen"
      @close="isNewIdentityModalOpen = false"
      @saved="handleIdentityCreated"
    />
  </div>
</template>
