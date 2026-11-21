<script setup lang="ts">
import BaseModal from "../common/BaseModal.vue";
import BaseButton from "../common/BaseButton.vue";
import { ref, watch, computed } from "vue";
import { useVaultStore } from "../../stores/vault.store";
import { sshConfigService } from "../../services/ssh_config.service";
import type {
  SshConfigPreview,
  ParsedHostEntry,
  ImportSummary,
} from "../../types/ssh_config";
import {
  X,
  FileCode,
  FolderInput,
  KeyRound,
  ShieldCheck,
  Check,
  AlertTriangle,
  RefreshCw,
  Server,
  Network,
} from "lucide-vue-next";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "imported", summary: ImportSummary): void;
}>();

const vaultStore = useVaultStore();

const isLoading = ref(false);
const isImporting = ref(false);
const error = ref<string | null>(null);
const preview = ref<SshConfigPreview | null>(null);

const selectedAliases = ref<Set<string>>(new Set());
const folderName = ref("Importados de SSH Config");
const importKnownHosts = ref(true);
const overwriteDuplicates = ref(false);
const importResult = ref<ImportSummary | null>(null);

const allSelected = computed(() => {
  if (!preview.value || preview.value.hosts.length === 0) return false;
  return preview.value.hosts.every((h) => selectedAliases.value.has(h.alias));
});

function toggleSelectAll() {
  if (allSelected.value) {
    selectedAliases.value.clear();
  } else if (preview.value) {
    selectedAliases.value = new Set(preview.value.hosts.map((h) => h.alias));
  }
}

function toggleHost(alias: string) {
  if (selectedAliases.value.has(alias)) {
    selectedAliases.value.delete(alias);
  } else {
    selectedAliases.value.add(alias);
  }
}

async function loadPreview() {
  isLoading.value = true;
  error.value = null;
  importResult.value = null;

  try {
    const data = await sshConfigService.detectSshConfig();
    preview.value = data;
    // By default, select all non-duplicates
    const initialSelection = new Set<string>();
    for (const h of data.hosts) {
      if (!h.is_duplicate) {
        initialSelection.add(h.alias);
      }
    }
    // If all are duplicates, select all anyway so user has an active choice
    if (initialSelection.size === 0 && data.hosts.length > 0) {
      for (const h of data.hosts) {
        initialSelection.add(h.alias);
      }
    }
    selectedAliases.value = initialSelection;
  } catch (err: any) {
    error.value = typeof err === "string" ? err : err?.message || "Error al leer ~/.ssh/config";
  } finally {
    isLoading.value = false;
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      loadPreview();
    }
  }
);

async function handleImport() {
  if (!preview.value) return;

  const selectedHosts: ParsedHostEntry[] = preview.value.hosts.filter((h) =>
    selectedAliases.value.has(h.alias)
  );

  if (selectedHosts.length === 0 && !importKnownHosts.value) {
    error.value = "Selecciona al menos un servidor para importar.";
    return;
  }

  isImporting.value = true;
  error.value = null;

  try {
    const summary = await sshConfigService.importSshConfig({
      selected_hosts: selectedHosts,
      folder_name: folderName.value.trim() ? folderName.value.trim() : null,
      import_known_hosts: importKnownHosts.value,
      overwrite_duplicates: overwriteDuplicates.value,
    });

    importResult.value = summary;
    await vaultStore.fetchInventory();
    emit("imported", summary);
  } catch (err: any) {
    error.value = typeof err === "string" ? err : err?.message || "Error durante la importación.";
  } finally {
    isImporting.value = false;
  }
}
</script>

<template>
  <BaseModal v-if="isOpen" title="Importar desde ~/.ssh/config & known_hosts" size="lg" @close="emit('close')">
    <template #icon><FileCode class="w-4 h-4" /></template>
      <div class="space-y-4">
        <!-- Loading state -->
        <div v-if="isLoading" class="py-12 flex flex-col items-center justify-center space-y-3">
          <RefreshCw class="w-6 h-6 text-accent animate-spin" />
          <p class="text-xs text-fg-muted">Analizando archivos OpenSSH locales...</p>
        </div>

        <!-- Success summary state -->
        <div v-else-if="importResult" class="py-8 px-4 text-center space-y-4">
          <div class="w-12 h-12 rounded-full bg-success/20 text-success flex items-center justify-center mx-auto">
            <Check class="w-6 h-6" />
          </div>
          <div>
            <h4 class="text-base font-bold text-fg">¡Importación Completada con Éxito!</h4>
            <p class="text-xs text-fg-muted mt-1">
              Los servidores e identidades seleccionados han sido migrados a tu bóveda cifrada.
            </p>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-lg mx-auto pt-2">
            <div class="p-3 bg-app border border-line rounded-xl text-center">
              <div class="text-lg font-bold text-accent">{{ importResult.hosts_imported }}</div>
              <div class="text-[10px] text-fg-muted">Servidores</div>
            </div>
            <div class="p-3 bg-app border border-line rounded-xl text-center">
              <div class="text-lg font-bold text-accent">{{ importResult.identities_created }}</div>
              <div class="text-[10px] text-fg-muted">Identidades</div>
            </div>
            <div class="p-3 bg-app border border-line rounded-xl text-center">
              <div class="text-lg font-bold text-success">{{ importResult.known_hosts_imported }}</div>
              <div class="text-[10px] text-fg-muted">Known Hosts</div>
            </div>
            <div class="p-3 bg-app border border-line rounded-xl text-center">
              <div class="text-lg font-bold text-warning">{{ importResult.hosts_skipped }}</div>
              <div class="text-[10px] text-fg-muted">Omitidos</div>
            </div>
          </div>

          <div class="pt-4">
            <button
              type="button"
              @click="emit('close')"
              class="px-5 py-2 bg-accent text-on-accent font-semibold rounded-xl text-xs hover:opacity-90 transition cursor-pointer"
            >
              Listo
            </button>
          </div>
        </div>

        <!-- Detected review list state -->
        <div v-else-if="preview" class="space-y-4">
          <!-- Status Banner -->
          <div class="p-3 bg-app border border-line rounded-xl flex items-center justify-between text-xs">
            <div class="space-y-0.5 truncate">
              <div class="flex items-center space-x-1.5 font-medium text-fg">
                <span>Archivo detectado:</span>
                <span class="font-mono text-[11px] text-fg-muted truncate">{{ preview.config_path }}</span>
              </div>
              <div class="text-[11px] text-fg-muted">
                {{ preview.hosts.length }} servidores encontrados • {{ preview.known_hosts_count }} claves en known_hosts
              </div>
            </div>
            <button
              type="button"
              @click="loadPreview"
              class="p-1.5 text-fg-muted hover:text-fg hover:bg-active rounded-lg transition shrink-0 cursor-pointer"
              title="Volver a escanear"
            >
              <RefreshCw class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Empty config warning -->
          <div v-if="preview.hosts.length === 0" class="p-4 bg-warning/15 border border-warning/30 rounded-xl text-xs text-warning">
            No se encontraron bloques <code>Host</code> utilizables en tu archivo <code>~/.ssh/config</code>.
          </div>

          <!-- Hosts Selection Table -->
          <div v-else class="space-y-2">
            <div class="flex items-center justify-between text-xs px-1">
              <label class="flex items-center space-x-2 cursor-pointer font-medium text-fg">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  @change="toggleSelectAll"
                  class="rounded border-line bg-app text-accent focus:ring-accent cursor-pointer"
                />
                <span>Seleccionar todos ({{ selectedAliases.size }} seleccionados)</span>
              </label>

              <span class="text-[11px] text-fg-muted">
                Haz clic en cualquier servidor para incluirlo/excluirlo
              </span>
            </div>

            <div class="border border-line rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-line/60 bg-app/40">
              <div
                v-for="host in preview.hosts"
                :key="host.alias"
                @click="toggleHost(host.alias)"
                class="p-2.5 flex items-center justify-between hover:bg-active/80 cursor-pointer transition text-xs"
                :class="{ 'opacity-60': !selectedAliases.has(host.alias) }"
              >
                <div class="flex items-center space-x-2.5 truncate min-w-0">
                  <input
                    type="checkbox"
                    :checked="selectedAliases.has(host.alias)"
                    @click.stop="toggleHost(host.alias)"
                    class="rounded border-line bg-app text-accent focus:ring-accent cursor-pointer"
                  />
                  <Server class="w-4 h-4 text-accent shrink-0" />
                  <div class="truncate">
                    <div class="flex items-center space-x-1.5 truncate">
                      <span class="font-bold text-fg">{{ host.alias }}</span>
                      <span
                        v-if="host.is_duplicate"
                        class="text-[9px] px-1.5 py-0.2 rounded bg-warning/15 border border-warning/30 text-warning font-medium shrink-0 flex items-center space-x-0.5"
                      >
                        <AlertTriangle class="w-2.5 h-2.5" />
                        <span>Ya existe</span>
                      </span>
                    </div>
                    <div class="text-[10px] text-fg-muted font-mono truncate">
                      {{ host.user ? host.user + '@' : '' }}{{ host.hostname }}:{{ host.port }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center space-x-1.5 shrink-0 text-[10px]">
                  <span
                    v-if="host.identity_file"
                    class="px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-mono flex items-center space-x-1"
                    :title="host.identity_file"
                  >
                    <KeyRound class="w-2.5 h-2.5" />
                    <span class="max-w-[100px] truncate">{{ host.identity_file.split('/').pop() }}</span>
                  </span>
                  <span
                    v-if="host.proxy_jump"
                    class="px-1.5 py-0.5 rounded bg-info/10 border border-info/20 text-info font-mono flex items-center space-x-1"
                    :title="'Jump: ' + host.proxy_jump"
                  >
                    <Network class="w-2.5 h-2.5" />
                    <span class="max-w-[80px] truncate">{{ host.proxy_jump }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Options -->
          <div class="p-3.5 bg-app border border-line rounded-xl space-y-3">
            <div>
              <label class="block text-xs font-medium text-fg-muted mb-1 flex items-center space-x-1.5">
                <FolderInput class="w-3.5 h-3.5 text-accent" />
                <span>Carpeta contenedora de importación</span>
              </label>
              <input
                v-model="folderName"
                type="text"
                placeholder="ej. Importados de SSH Config (o en blanco para raíz)"
                class="w-full px-3 py-1.5 bg-surface border border-line rounded-lg text-xs text-fg focus:outline-none focus:border-accent transition"
              />
            </div>

            <div class="space-y-2 pt-1 border-t border-line/60 text-xs">
              <label class="flex items-center space-x-2 text-fg cursor-pointer">
                <input
                  v-model="importKnownHosts"
                  type="checkbox"
                  class="rounded border-line bg-surface text-accent focus:ring-accent cursor-pointer"
                />
                <ShieldCheck class="w-3.5 h-3.5 text-success" />
                <span>Pre-cargar claves de confianza desde <code>known_hosts</code> (evita alertas TOFU)</span>
              </label>

              <label class="flex items-center space-x-2 text-fg cursor-pointer">
                <input
                  v-model="overwriteDuplicates"
                  type="checkbox"
                  class="rounded border-line bg-surface text-accent focus:ring-accent cursor-pointer"
                />
                <AlertTriangle class="w-3.5 h-3.5 text-warning" />
                <span>Sobrescribir servidores duplicados si ya existen en la bóveda</span>
              </label>
            </div>
          </div>
        </div>

        <div v-if="error" class="p-3 bg-danger/15 border border-danger/30 rounded-xl text-xs text-danger">
          {{ error }}
        </div>
      </div>

    <template v-if="!importResult" #footer>
      <span class="text-xs text-fg-muted mr-auto">
        {{ selectedAliases.size }} servidores listos para migrar
      </span>
      <BaseButton variant="ghost" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton
        variant="primary"
        :loading="isImporting"
        :disabled="selectedAliases.size === 0"
        @click="handleImport"
      >
        {{ isImporting ? 'Importando...' : 'Iniciar Importación' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
