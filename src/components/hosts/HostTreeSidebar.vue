<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useVaultStore } from "../../stores/vault.store";
import { useSftpStore } from "../../stores/sftp.store";
import type { HostSummary, Folder, IdentitySummary } from "../../types/inventory";
import HostModal from "./HostModal.vue";
import FolderModal from "./FolderModal.vue";
import IdentityModal from "./IdentityModal.vue";
import SshConfigImportModal from "./SshConfigImportModal.vue";
import {
  Server,
  Folder as FolderIcon,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  KeyRound,
  Edit2,
  Trash2,
  Terminal,
  Shield,
  PanelLeftClose,
  Copy,
  Check,
  FileCode,
  FolderSync,
} from "lucide-vue-next";

const { t } = useI18n();
const emit = defineEmits<{
  (e: "connect-host", host: HostSummary): void;
  (e: "open-local-pty"): void;
  (e: "toggle-sidebar"): void;
}>();

const vaultStore = useVaultStore();
const sftpStore = useSftpStore();

const searchQuery = ref("");
const collapsedFolders = ref<Record<string, boolean>>({});
const activeTab = ref<"hosts" | "identities">("hosts");

// Modal states
const isHostModalOpen = ref(false);
const hostToEdit = ref<HostSummary | null>(null);

const isFolderModalOpen = ref(false);
const folderToEdit = ref<Folder | null>(null);

const isIdentityModalOpen = ref(false);
const identityToEdit = ref<IdentitySummary | null>(null);

const isSshConfigModalOpen = ref(false);

function toggleFolder(folderId: string) {
  collapsedFolders.value[folderId] = !collapsedFolders.value[folderId];
}

const filteredHosts = computed(() => {
  if (!searchQuery.value.trim()) return vaultStore.hosts;
  const q = searchQuery.value.toLowerCase();
  return vaultStore.hosts.filter(
    (h) =>
      h.label.toLowerCase().includes(q) ||
      h.hostname.toLowerCase().includes(q) ||
      h.tags.some((t) => t.toLowerCase().includes(q))
  );
});

const rootHosts = computed(() => {
  return filteredHosts.value.filter((h) => !h.folder_id);
});

function getFolderHosts(folderId: string) {
  return filteredHosts.value.filter((h) => h.folder_id === folderId);
}

// Actions
function openAddHost(folderId?: string) {
  hostToEdit.value = null;
  isHostModalOpen.value = true;
}

function openEditHost(host: HostSummary) {
  hostToEdit.value = host;
  isHostModalOpen.value = true;
}

async function handleDeleteHost(id: string) {
  if (confirm("¿Estás seguro de eliminar este servidor?")) {
    await vaultStore.deleteHost(id);
  }
}

function openAddFolder() {
  folderToEdit.value = null;
  isFolderModalOpen.value = true;
}

function openEditFolder(folder: Folder) {
  folderToEdit.value = folder;
  isFolderModalOpen.value = true;
}

async function handleDeleteFolder(id: string) {
  if (confirm("¿Estás seguro de eliminar esta carpeta?")) {
    await vaultStore.deleteFolder(id);
  }
}

function openAddIdentity() {
  identityToEdit.value = null;
  isIdentityModalOpen.value = true;
}

function openEditIdentity(identity: IdentitySummary) {
  identityToEdit.value = identity;
  isIdentityModalOpen.value = true;
}

const copiedIdentityId = ref<string | null>(null);

async function copyIdentityPublicKey(identity: IdentitySummary) {
  if (identity.public_key) {
    await navigator.clipboard.writeText(identity.public_key);
    copiedIdentityId.value = identity.id;
    setTimeout(() => {
      copiedIdentityId.value = null;
    }, 2000);
  }
}

function getIdentityBadge(identity: IdentitySummary): { label: string; class: string; icon: string } {
  if (identity.auth_type === 'password') {
    return {
      label: 'Password',
      class: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      icon: '🔒',
    };
  }
  if (identity.auth_type === 'agent') {
    return {
      label: 'Agent',
      class: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      icon: '🛡️',
    };
  }
  const pub = identity.public_key?.toLowerCase() || '';
  if (pub.startsWith('ssh-ed25519')) {
    return {
      label: 'Ed25519',
      class: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      icon: '🔑',
    };
  }
  if (pub.startsWith('ssh-rsa')) {
    return {
      label: 'RSA 4096',
      class: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
      icon: '🔑',
    };
  }
  return {
    label: 'Key',
    class: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    icon: '🔑',
  };
}

async function handleDeleteIdentity(id: string) {
  if (confirm("¿Estás seguro de eliminar esta credencial?")) {
    await vaultStore.deleteIdentity(id);
  }
}
</script>

<template>
  <aside class="w-72 bg-theme-surface border-r border-theme flex flex-col h-full select-none shrink-0">
    <!-- Top toolbar & tabs -->
    <div class="p-3 border-b border-theme space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-1 bg-theme-app p-0.5 rounded-lg border border-theme text-xs">
          <button
            @click="activeTab = 'hosts'"
            class="px-2.5 py-1 rounded-md font-medium transition cursor-pointer"
            :class="activeTab === 'hosts' ? 'bg-theme-active text-theme-accent font-semibold shadow-xs' : 'text-theme-muted hover:text-theme-main'"
          >
            {{ t('hosts.title') }} ({{ vaultStore.hosts.length }})
          </button>
          <button
            @click="activeTab = 'identities'"
            class="px-2.5 py-1 rounded-md font-medium transition cursor-pointer"
            :class="activeTab === 'identities' ? 'bg-theme-active text-theme-accent font-semibold shadow-xs' : 'text-theme-muted hover:text-theme-main'"
          >
            {{ t('hostModal.identity') }} ({{ vaultStore.identities.length }})
          </button>
        </div>

        <div class="flex items-center space-x-1">
          <button
            @click="emit('open-local-pty')"
            :title="t('terminal.newLocal')"
            class="p-1.5 text-theme-muted hover:text-theme-accent hover:bg-theme-active rounded-lg transition cursor-pointer"
          >
            <Terminal class="w-4 h-4" />
          </button>
          <button
            @click="emit('toggle-sidebar')"
            title="Ocultar Barra Lateral (Ctrl+B)"
            class="p-1.5 text-theme-muted hover:text-theme-main hover:bg-theme-active rounded-lg transition cursor-pointer"
          >
            <PanelLeftClose class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Quick search input -->
      <div class="relative">
        <Search class="w-3.5 h-3.5 text-theme-muted absolute left-2.5 top-2.5" />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('hosts.searchPlaceholder')"
          class="w-full pl-8 pr-2.5 py-1.5 bg-theme-app border border-theme rounded-lg text-xs text-theme-main placeholder-slate-500 focus:outline-hidden focus:border-theme-accent transition"
        />
      </div>

      <!-- Quick add buttons -->
      <div v-if="activeTab === 'hosts'" class="flex items-center space-x-1.5">
        <button
          @click="openAddHost()"
          class="flex-1 py-1 px-2 bg-theme-active hover:brightness-110 border border-theme text-theme-accent rounded-lg text-[11px] font-medium flex items-center justify-center space-x-1 transition cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>{{ t('hosts.newHost') }}</span>
        </button>
        <button
          @click="openAddFolder()"
          class="py-1 px-2 bg-theme-app hover:bg-theme-active border border-theme text-theme-muted hover:text-theme-main rounded-lg text-[11px] font-medium flex items-center justify-center space-x-1 transition cursor-pointer"
          :title="t('hosts.newFolder')"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>{{ t('hosts.newFolder') }}</span>
        </button>
        <button
          @click="isSshConfigModalOpen = true"
          class="p-1 px-1.5 bg-theme-app hover:bg-theme-active border border-theme text-theme-muted hover:text-cyan-400 rounded-lg text-[11px] font-medium flex items-center justify-center transition cursor-pointer"
          title="Importar desde ~/.ssh/config"
        >
          <FileCode class="w-3.5 h-3.5" />
        </button>
      </div>

      <div v-else class="flex items-center space-x-1.5">
        <button
          @click="openAddIdentity()"
          class="w-full py-1 px-2 bg-theme-active hover:brightness-110 border border-theme text-theme-accent rounded-lg text-[11px] font-medium flex items-center justify-center space-x-1 transition cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>{{ t('hosts.newIdentity') }}</span>
        </button>
      </div>
    </div>

    <!-- Tree Body -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      <!-- HOSTS TAB -->
      <div v-if="activeTab === 'hosts'">
        <!-- Folders -->
        <div v-for="folder in vaultStore.folders" :key="folder.id" class="mb-1">
          <div
            class="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/60 group cursor-pointer text-xs"
            @click="toggleFolder(folder.id)"
          >
            <div class="flex items-center space-x-1.5 truncate">
              <ChevronDown v-if="!collapsedFolders[folder.id]" class="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <ChevronRight v-else class="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div
                class="w-2 h-2 rounded-full shrink-0"
                :style="{ backgroundColor: folder.color || '#38bdf8' }"
              ></div>
              <span class="font-medium text-slate-200 truncate">{{ folder.name }}</span>
              <span class="text-[10px] text-slate-500">({{ getFolderHosts(folder.id).length }})</span>
            </div>

            <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                @click.stop="openEditFolder(folder)"
                class="p-1 hover:text-cyan-400 text-slate-400 rounded"
                title="Editar Carpeta"
              >
                <Edit2 class="w-3 h-3" />
              </button>
              <button
                @click.stop="handleDeleteFolder(folder.id)"
                class="p-1 hover:text-red-400 text-slate-400 rounded"
                title="Eliminar Carpeta"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>

          <!-- Hosts in folder -->
          <div v-if="!collapsedFolders[folder.id]" class="pl-4 space-y-0.5 mt-0.5">
            <div
              v-for="host in getFolderHosts(folder.id)"
              :key="host.id"
              @dblclick="emit('connect-host', host)"
              class="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/80 group cursor-pointer text-xs transition"
            >
              <div class="flex items-center space-x-2 truncate">
                <Server class="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />
                <div class="truncate">
                  <div class="font-medium text-slate-200 truncate leading-tight">{{ host.label }}</div>
                  <div class="text-[10px] text-slate-500 font-mono truncate leading-tight">
                    {{ host.hostname }}:{{ host.port }}
                  </div>
                </div>
              </div>

              <div class="flex items-center space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <button
                  @click.stop="emit('connect-host', host)"
                  class="p-1 text-cyan-400 hover:bg-cyan-500/20 rounded cursor-pointer"
                  title="Conectar Terminal SSH"
                >
                  <Terminal class="w-3.5 h-3.5" />
                </button>
                <button
                  @click.stop="sftpStore.openSftp(host.id)"
                  class="p-1 text-amber-400 hover:bg-amber-500/20 rounded cursor-pointer"
                  title="Explorador SFTP (Archivos)"
                >
                  <FolderSync class="w-3.5 h-3.5" />
                </button>
                <button
                  @click.stop="openEditHost(host)"
                  class="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                  title="Editar"
                >
                  <Edit2 class="w-3 h-3" />
                </button>
                <button
                  @click.stop="handleDeleteHost(host.id)"
                  class="p-1 text-slate-400 hover:text-red-400 rounded cursor-pointer"
                  title="Eliminar"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Root hosts (outside folders) -->
        <div v-if="rootHosts.length > 0" class="mt-2 space-y-0.5">
          <div class="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Sin Carpeta
          </div>
          <div
            v-for="host in rootHosts"
            :key="host.id"
            @dblclick="emit('connect-host', host)"
            class="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/80 group cursor-pointer text-xs transition"
          >
            <div class="flex items-center space-x-2 truncate">
              <Server class="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />
              <div class="truncate">
                <div class="font-medium text-slate-200 truncate leading-tight">{{ host.label }}</div>
                <div class="text-[10px] text-slate-500 font-mono truncate leading-tight">
                  {{ host.hostname }}:{{ host.port }}
                </div>
              </div>
            </div>

            <div class="flex items-center space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <button
                @click.stop="emit('connect-host', host)"
                class="p-1 text-cyan-400 hover:bg-cyan-500/20 rounded cursor-pointer"
                title="Conectar Terminal SSH"
              >
                <Terminal class="w-3.5 h-3.5" />
              </button>
              <button
                @click.stop="sftpStore.openSftp(host.id)"
                class="p-1 text-amber-400 hover:bg-amber-500/20 rounded cursor-pointer"
                title="Explorador SFTP (Archivos)"
              >
                <FolderSync class="w-3.5 h-3.5" />
              </button>
              <button
                @click.stop="openEditHost(host)"
                class="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                title="Editar"
              >
                <Edit2 class="w-3 h-3" />
              </button>
              <button
                @click.stop="handleDeleteHost(host.id)"
                class="p-1 text-slate-400 hover:text-red-400 rounded cursor-pointer"
                title="Eliminar"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="vaultStore.hosts.length === 0" class="p-4 text-center text-xs text-slate-500 space-y-3">
          <p>No hay servidores guardados. Haz clic en <strong>+ Servidor</strong> para agregar el primero.</p>
          <button
            @click="isSshConfigModalOpen = true"
            class="px-3 py-1.5 bg-theme-surface hover:bg-theme-active border border-theme rounded-lg text-theme-accent text-xs font-medium inline-flex items-center space-x-1.5 transition cursor-pointer"
          >
            <FileCode class="w-3.5 h-3.5" />
            <span>Importar ~/.ssh/config</span>
          </button>
        </div>
      </div>

      <!-- IDENTITIES TAB -->
      <div v-else class="space-y-1">
        <div
          v-for="identity in vaultStore.identities"
          :key="identity.id"
          class="flex items-center justify-between px-2.5 py-2 rounded-lg bg-theme-surface hover:bg-theme-active border border-theme group text-xs transition"
        >
          <div class="flex items-center space-x-2 truncate min-w-0">
            <KeyRound class="w-4 h-4 text-theme-accent shrink-0" />
            <div class="truncate">
              <div class="flex items-center space-x-1.5 truncate">
                <span class="font-medium text-theme-main truncate">{{ identity.name }}</span>
                <span
                  :class="['text-[9px] px-1.5 py-0.2 rounded border font-mono shrink-0', getIdentityBadge(identity).class]"
                >
                  {{ getIdentityBadge(identity).icon }} {{ getIdentityBadge(identity).label }}
                </span>
              </div>
              <div class="text-[10px] text-theme-muted font-mono truncate">
                {{ identity.username }}
              </div>
            </div>
          </div>

          <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              v-if="identity.public_key"
              @click.stop="copyIdentityPublicKey(identity)"
              class="p-1 text-theme-muted hover:text-theme-accent rounded transition cursor-pointer"
              :title="copiedIdentityId === identity.id ? '¡Clave copiada!' : 'Copiar clave pública'"
            >
              <Check v-if="copiedIdentityId === identity.id" class="w-3 h-3 text-emerald-400" />
              <Copy v-else class="w-3 h-3" />
            </button>
            <button
              @click="openEditIdentity(identity)"
              class="p-1 text-theme-muted hover:text-theme-main rounded transition cursor-pointer"
              title="Editar Credencial"
            >
              <Edit2 class="w-3 h-3" />
            </button>
            <button
              @click="handleDeleteIdentity(identity.id)"
              class="p-1 text-theme-muted hover:text-red-400 rounded transition cursor-pointer"
              title="Eliminar Credencial"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>

        <div v-if="vaultStore.identities.length === 0" class="p-4 text-center text-xs text-slate-500">
          No hay credenciales guardadas. Agrega una para reutilizar usuario, contraseña o llave SSH.
        </div>
      </div>
    </div>

    <!-- Modals -->
    <HostModal
      :is-open="isHostModalOpen"
      :host-to-edit="hostToEdit"
      @close="isHostModalOpen = false"
    />

    <FolderModal
      :is-open="isFolderModalOpen"
      :folder-to-edit="folderToEdit"
      @close="isFolderModalOpen = false"
    />

    <IdentityModal
      :is-open="isIdentityModalOpen"
      :identity-to-edit="identityToEdit"
      @close="isIdentityModalOpen = false"
    />

    <SshConfigImportModal
      :is-open="isSshConfigModalOpen"
      @close="isSshConfigModalOpen = false"
    />
  </aside>
</template>
