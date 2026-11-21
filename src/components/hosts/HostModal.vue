<script setup lang="ts">
import BaseModal from "../common/BaseModal.vue";
import BaseButton from "../common/BaseButton.vue";
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
  { value: "rdp", label: t('ui.host.rdp'), icon: Server },
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
      label: t('ui.host.noFolder'),
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
      label: t('ui.host.noIdentity'),
      subtitle: t('ui.host.noIdentitySub'),
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
      label: t('ui.host.direct'),
      subtitle: t('ui.host.directSub'),
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
    error.value = t('ui.host.required');
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
  <template v-if="isOpen">
  <BaseModal :title="hostToEdit ? t('ui.host.edit') : t('ui.host.new')" size="md" @close="emit('close')">
    <template #icon><Server class="w-4 h-4" /></template>

    <form id="host-form" @submit.prevent="handleSave" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-fg-muted mb-1">{{ t('ui.host.label') }}</label>
          <input
            v-model="label"
            type="text"
            required
            :placeholder="t('ui.host.labelPlaceholder')"
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
            <label class="block text-xs font-medium text-fg-muted mb-1">{{ t('ui.host.hostname') }}</label>
            <div class="relative">
              <Globe class="w-4 h-4 text-fg-muted absolute left-3 top-2.5" />
              <input
                v-model="hostname"
                type="text"
                required
                :placeholder="t('ui.host.hostnamePlaceholder')"
                class="w-full pl-9 pr-3 py-2 bg-app border border-line rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-fg-muted mb-1">{{ t('ui.host.port') }}</label>
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
              <label class="block text-xs font-medium text-fg-muted">{{ t('ui.host.folder') }}</label>
              <button
                type="button"
                @click="isNewFolderModalOpen = true"
                class="text-[11px] text-accent hover:underline flex items-center space-x-0.5 cursor-pointer"
              >
                <Plus class="w-3 h-3" />
                <span>{{ t('ui.host.newShort') }}</span>
              </button>
            </div>
            <CustomSelect
              v-model="folderId"
              :options="folderOptions"
              :placeholder="t('ui.host.folderPlaceholder')"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-medium text-fg-muted">{{ t('ui.host.identity') }}</label>
              <button
                type="button"
                @click="isNewIdentityModalOpen = true"
                class="text-[11px] text-accent hover:underline flex items-center space-x-0.5 cursor-pointer"
              >
                <Plus class="w-3 h-3" />
                <span>{{ t('ui.host.newShort') }}</span>
              </button>
            </div>
            <CustomSelect
              v-model="identityId"
              :options="identityOptions"
              :placeholder="t('ui.host.identityPlaceholder')"
            />
            <div v-if="selectedIdentity?.public_key" class="mt-1 text-[10px] font-mono text-fg-muted truncate" :title="selectedIdentity.public_key">
              🔑 {{ selectedIdentity.public_key.slice(0, 36) }}...
            </div>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-fg-muted mb-1 flex items-center space-x-1.5">
            <Route class="w-3.5 h-3.5 text-accent" />
            <span>{{ t('ui.host.jump') }}</span>
          </label>
          <CustomSelect
            v-model="jumpHostId"
            :options="jumpHostOptions"
            :placeholder="t('ui.host.jumpPlaceholder')"
          />
          <p class="mt-1 text-[11px] text-fg-muted">
            {{ t('ui.host.jumpHelp') }}
          </p>
        </div>

        <div>
          <label class="block text-xs font-medium text-fg-muted mb-1">
            {{ t('ui.host.userOverride') }}
          </label>
          <input
            v-model="usernameOverride"
            type="text"
            :placeholder="t('ui.host.userOverridePlaceholder')"
            class="w-full px-3 py-2 bg-app border border-line rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-fg-muted mb-1">{{ t('ui.host.tags') }}</label>
          <div class="relative">
            <Tag class="w-4 h-4 text-fg-muted absolute left-3 top-2.5" />
            <input
              v-model="tagsInput"
              type="text"
              :placeholder="t('ui.host.tagsPlaceholder')"
              class="w-full pl-9 pr-3 py-2 bg-app border border-line rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-fg-muted mb-1">{{ t('ui.host.notes') }}</label>
          <div class="relative">
            <textarea
              v-model="notes"
              rows="2"
              :placeholder="t('ui.host.notesPlaceholder')"
              class="w-full px-3 py-2 bg-app border border-line rounded-xl text-xs text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
            ></textarea>
          </div>
        </div>

        <div v-if="error" class="p-3 bg-danger/15 border border-danger/30 rounded-xl text-xs text-danger">
          {{ error }}
        </div>

        </form>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" variant="primary" :loading="isSubmitting" form="host-form">
        {{ t('ui.host.save') }}
      </BaseButton>
    </template>
  </BaseModal>

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
  </template>
</template>
