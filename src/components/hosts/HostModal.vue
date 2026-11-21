<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useVaultStore } from "../../stores/vault.store";
import { DEFAULT_PORTS, type HostProtocol, type HostSummary, type SaveHostPayload } from "../../types/inventory";
import { useI18n } from "vue-i18n";
import FolderModal from "./FolderModal.vue";
import IdentityModal from "./IdentityModal.vue";
import CustomSelect, { type SelectOption } from "../common/CustomSelect.vue";
import {
  X,
  Server,
  Globe,
  Tag,
  Plus,
  KeyRound,
  Route,
  Folder as FolderIcon,
  Shield,
  ShieldOff,
  Lock,
} from "lucide-vue-next";

const props = defineProps<{
  isOpen: boolean;
  hostToEdit?: HostSummary | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const vaultStore = useVaultStore();
const { t } = useI18n();

const label = ref("");
const hostname = ref("");
const protocol = ref<HostProtocol>("ssh");
const rdpDomain = ref("");
const port = ref(22);
const protocolOptions = computed<SelectOption[]>(() => [
  { value: "ssh", label: "SSH", icon: Server },
  { value: "rdp", label: "RDP (Escritorio remoto)", icon: Server },
  { value: "vnc", label: "VNC", icon: Server },
]);

// Al cambiar de protocolo, si el puerto era el predeterminado del anterior, usa el del nuevo.
watch(protocol, (next, prev) => {
  if (prev && Number(port.value) === DEFAULT_PORTS[prev]) port.value = DEFAULT_PORTS[next];
});
const folderId = ref<string | null>(null);
const identityId = ref<string | null>(null);
const jumpHostId = ref<string | null>(null);
const selectedIdentity = computed(() => vaultStore.identities.find((i) => i.id === identityId.value));
const availableJumpHosts = computed(() =>
  vaultStore.hosts.filter((h) => !props.hostToEdit || h.id !== props.hostToEdit.id)
);

const folderOptions = computed<SelectOption[]>(() => {
  const opts: SelectOption[] = [
    {
      value: null,
      label: "Sin carpeta (Raíz)",
      icon: FolderIcon,
      iconColor: "text-fg-muted",
    },
  ];
  for (const folder of vaultStore.folders) {
    opts.push({
      value: folder.id,
      label: folder.name,
      icon: FolderIcon,
      iconColor: folder.color || "text-warning",
    });
  }
  return opts;
});

const identityOptions = computed<SelectOption[]>(() => {
  const opts: SelectOption[] = [
    {
      value: null,
      label: "Sin credencial vinculada",
      subtitle: "Autenticación anónima o interactiva",
      icon: ShieldOff,
      iconColor: "text-fg-muted",
    },
  ];
  for (const ident of vaultStore.identities) {
    const icon = ident.auth_type === "agent" ? Shield : ident.auth_type === "password" ? Lock : KeyRound;
    const iconColor =
      ident.auth_type === "agent"
        ? "text-info"
        : ident.auth_type === "password"
        ? "text-accent"
        : "text-warning";
    const typeLabel =
      ident.auth_type === "password"
        ? "Password"
        : ident.auth_type === "agent"
        ? "SSH-Agent"
        : ident.public_key?.startsWith("ssh-ed25519")
        ? "Ed25519"
        : ident.public_key?.startsWith("ssh-rsa")
        ? "RSA"
        : "Key";

    opts.push({
      value: ident.id,
      label: ident.name,
      subtitle: `${ident.username} • ${typeLabel}`,
      badge: ident.auth_type.toUpperCase(),
      icon,
      iconColor,
    });
  }
  return opts;
});

const jumpHostOptions = computed<SelectOption[]>(() => {
  const opts: SelectOption[] = [
    {
      value: null,
      label: "Conexión directa",
      subtitle: "Sin servidor de salto intermedio",
      icon: Globe,
      iconColor: "text-fg-muted",
    },
  ];
  for (const jHost of availableJumpHosts.value) {
    opts.push({
      value: jHost.id,
      label: jHost.label,
      subtitle: `${jHost.hostname}:${jHost.port}`,
      badge: jHost.port !== 22 ? `:${jHost.port}` : undefined,
      icon: Route,
      iconColor: "text-warning",
    });
  }
  return opts;
});

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
      protocol.value = host.protocol ?? "ssh";
      rdpDomain.value = host.rdp_domain || "";
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
      protocol.value = "ssh";
      rdpDomain.value = "";
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
      protocol: protocol.value,
      rdp_domain: protocol.value === "rdp" && rdpDomain.value.trim() ? rdpDomain.value.trim() : null,
      port: Number(port.value) || DEFAULT_PORTS[protocol.value],
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
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-xs p-4">
    <div class="w-full max-w-lg bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-fg transition-colors">
      <!-- Header -->
      <div class="px-5 py-3.5 border-b border-line flex items-center justify-between bg-header">
        <div class="flex items-center space-x-2">
          <Server class="w-5 h-5 text-accent" />
          <h3 class="text-sm font-bold text-fg">
            {{ hostToEdit ? 'Editar Servidor' : 'Nuevo Servidor' }}
          </h3>
        </div>
        <button @click="emit('close')" class="text-fg-muted hover:text-fg p-1 rounded-lg hover:bg-active transition cursor-pointer">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSave" class="p-5 space-y-4 overflow-y-auto flex-1">
        <div>
          <label class="block text-xs font-medium text-fg-muted mb-1">Nombre / Alias del Servidor</label>
          <input
            v-model="label"
            type="text"
            required
            placeholder="ej. Web Server Producción / VPS Hetzner"
            class="w-full px-3 py-2 bg-app border border-line rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
          />
        </div>

        <div :class="protocol === 'rdp' ? 'grid grid-cols-2 gap-3' : ''">
          <div>
            <label class="block text-xs font-medium text-fg-muted mb-1">{{ t('hostModal.protocol') }}</label>
            <CustomSelect v-model="protocol" :options="protocolOptions" />
          </div>
          <div v-if="protocol === 'rdp'">
            <label class="block text-xs font-medium text-fg-muted mb-1">{{ t('hostModal.rdpDomain') }}</label>
            <input
              v-model="rdpDomain"
              type="text"
              placeholder="CORP"
              class="w-full px-3 py-2 bg-app border border-line rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
            />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label class="block text-xs font-medium text-fg-muted mb-1">Dirección IP o Hostname</label>
            <div class="relative">
              <Globe class="w-4 h-4 text-fg-muted absolute left-3 top-2.5" />
              <input
                v-model="hostname"
                type="text"
                required
                placeholder="192.168.1.100 o app.ejemplo.com"
                class="w-full pl-9 pr-3 py-2 bg-app border border-line rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-fg-muted mb-1">Puerto</label>
            <input
              v-model="port"
              type="number"
              min="1"
              max="65535"
              required
              class="w-full px-3 py-2 bg-app border border-line rounded-xl text-sm text-fg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-medium text-fg-muted">Carpeta</label>
              <button
                type="button"
                @click="isNewFolderModalOpen = true"
                class="text-[11px] text-accent hover:underline flex items-center space-x-0.5 cursor-pointer"
              >
                <Plus class="w-3 h-3" />
                <span>Nueva</span>
              </button>
            </div>
            <CustomSelect
              v-model="folderId"
              :options="folderOptions"
              placeholder="Seleccionar carpeta..."
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-medium text-fg-muted">Credencial / Identidad</label>
              <button
                type="button"
                @click="isNewIdentityModalOpen = true"
                class="text-[11px] text-accent hover:underline flex items-center space-x-0.5 cursor-pointer"
              >
                <Plus class="w-3 h-3" />
                <span>Nueva</span>
              </button>
            </div>
            <CustomSelect
              v-model="identityId"
              :options="identityOptions"
              placeholder="Seleccionar credencial..."
            />
            <div v-if="selectedIdentity?.public_key" class="mt-1 text-[10px] font-mono text-fg-muted truncate" :title="selectedIdentity.public_key">
              🔑 {{ selectedIdentity.public_key.slice(0, 36) }}...
            </div>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-fg-muted mb-1 flex items-center space-x-1.5">
            <Route class="w-3.5 h-3.5 text-accent" />
            <span>Servidor de Salto / Bastion (Opcional)</span>
          </label>
          <CustomSelect
            v-model="jumpHostId"
            :options="jumpHostOptions"
            placeholder="Conexión directa..."
          />
          <p class="mt-1 text-[11px] text-fg-muted">
            Si se especifica, NexusTerm tunelizará la conexión SSH a través de este Bastion usando direct-tcpip.
          </p>
        </div>

        <div>
          <label class="block text-xs font-medium text-fg-muted mb-1">
            Sobrescribir Usuario (Opcional)
          </label>
          <input
            v-model="usernameOverride"
            type="text"
            placeholder="Si difiere del usuario de la credencial"
            class="w-full px-3 py-2 bg-app border border-line rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-fg-muted mb-1">Etiquetas (separadas por coma)</label>
          <div class="relative">
            <Tag class="w-4 h-4 text-fg-muted absolute left-3 top-2.5" />
            <input
              v-model="tagsInput"
              type="text"
              placeholder="produccion, linux, nginx, aws"
              class="w-full pl-9 pr-3 py-2 bg-app border border-line rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-fg-muted mb-1">Notas Cifradas (Opcional)</label>
          <div class="relative">
            <textarea
              v-model="notes"
              rows="2"
              placeholder="Notas protegidas por la bóveda..."
              class="w-full px-3 py-2 bg-app border border-line rounded-xl text-xs text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
            ></textarea>
          </div>
        </div>

        <div v-if="error" class="p-3 bg-danger/15 border border-danger/30 rounded-xl text-xs text-danger">
          {{ error }}
        </div>

        <!-- Actions -->
        <div class="pt-3 border-t border-line flex items-center justify-end space-x-2">
          <button
            type="button"
            @click="emit('close')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-medium text-fg-muted hover:text-fg hover:bg-active transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="px-4 py-1.5 bg-accent hover:brightness-110 text-on-accent font-semibold rounded-xl text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
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
