<script setup lang="ts">
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
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
    <div class="w-full max-w-2xl bg-theme-surface border border-theme rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-theme-main transition-colors">
      <!-- Header -->
      <div class="px-5 py-3.5 border-b border-theme flex items-center justify-between bg-theme-header">
        <div class="flex items-center space-x-2">
          <FileCode class="w-5 h-5 text-theme-accent" />
          <h3 class="text-sm font-bold text-theme-main">
            Importar desde ~/.ssh/config & known_hosts
          </h3>
        </div>
        <button
          @click="emit('close')"
          class="text-theme-muted hover:text-theme-main p-1 rounded-lg hover:bg-theme-active transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-5 overflow-y-auto flex-1 space-y-4">
        <!-- Loading state -->
        <div v-if="isLoading" class="py-12 flex flex-col items-center justify-center space-y-3">
          <RefreshCw class="w-6 h-6 text-theme-accent animate-spin" />
          <p class="text-xs text-theme-muted">Analizando archivos OpenSSH locales...</p>
        </div>

        <!-- Success summary state -->
        <div v-else-if="importResult" class="py-8 px-4 text-center space-y-4">
          <div class="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <Check class="w-6 h-6" />
          </div>
          <div>
            <h4 class="text-base font-bold text-theme-main">¡Importación Completada con Éxito!</h4>
            <p class="text-xs text-theme-muted mt-1">
              Los servidores e identidades seleccionados han sido migrados a tu bóveda cifrada.
            </p>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-lg mx-auto pt-2">
            <div class="p-3 bg-theme-input border border-theme rounded-xl text-center">
              <div class="text-lg font-bold text-theme-accent">{{ importResult.hosts_imported }}</div>
              <div class="text-[10px] text-theme-muted">Servidores</div>
            </div>
            <div class="p-3 bg-theme-input border border-theme rounded-xl text-center">
              <div class="text-lg font-bold text-cyan-400">{{ importResult.identities_created }}</div>
              <div class="text-[10px] text-theme-muted">Identidades</div>
            </div>
            <div class="p-3 bg-theme-input border border-theme rounded-xl text-center">
              <div class="text-lg font-bold text-emerald-400">{{ importResult.known_hosts_imported }}</div>
              <div class="text-[10px] text-theme-muted">Known Hosts</div>
            </div>
            <div class="p-3 bg-theme-input border border-theme rounded-xl text-center">
              <div class="text-lg font-bold text-amber-400">{{ importResult.hosts_skipped }}</div>
              <div class="text-[10px] text-theme-muted">Omitidos</div>
            </div>
          </div>

          <div class="pt-4">
            <button
              type="button"
              @click="emit('close')"
              class="px-5 py-2 bg-theme-accent text-slate-950 font-semibold rounded-xl text-xs hover:opacity-90 transition cursor-pointer"
            >
              Listo
            </button>
          </div>
        </div>

        <!-- Detected review list state -->
        <div v-else-if="preview" class="space-y-4">
          <!-- Status Banner -->
          <div class="p-3 bg-theme-input border border-theme rounded-xl flex items-center justify-between text-xs">
            <div class="space-y-0.5 truncate">
              <div class="flex items-center space-x-1.5 font-medium text-theme-main">
                <span>Archivo detectado:</span>
                <span class="font-mono text-[11px] text-theme-muted truncate">{{ preview.config_path }}</span>
              </div>
              <div class="text-[11px] text-theme-muted">
                {{ preview.hosts.length }} servidores encontrados • {{ preview.known_hosts_count }} claves en known_hosts
              </div>
            </div>
            <button
              type="button"
              @click="loadPreview"
              class="p-1.5 text-theme-muted hover:text-theme-main hover:bg-theme-active rounded-lg transition shrink-0 cursor-pointer"
              title="Volver a escanear"
            >
              <RefreshCw class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Empty config warning -->
          <div v-if="preview.hosts.length === 0" class="p-4 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs text-amber-200">
            No se encontraron bloques <code>Host</code> utilizables en tu archivo <code>~/.ssh/config</code>.
          </div>

          <!-- Hosts Selection Table -->
          <div v-else class="space-y-2">
            <div class="flex items-center justify-between text-xs px-1">
              <label class="flex items-center space-x-2 cursor-pointer font-medium text-theme-main">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  @change="toggleSelectAll"
                  class="rounded border-theme bg-theme-input text-theme-accent focus:ring-theme-accent cursor-pointer"
                />
                <span>Seleccionar todos ({{ selectedAliases.size }} seleccionados)</span>
              </label>

              <span class="text-[11px] text-theme-muted">
                Haz clic en cualquier servidor para incluirlo/excluirlo
              </span>
            </div>

            <div class="border border-theme rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-theme/60 bg-theme-input/40">
              <div
                v-for="host in preview.hosts"
                :key="host.alias"
                @click="toggleHost(host.alias)"
                class="p-2.5 flex items-center justify-between hover:bg-theme-active/80 cursor-pointer transition text-xs"
                :class="{ 'opacity-60': !selectedAliases.has(host.alias) }"
              >
                <div class="flex items-center space-x-2.5 truncate min-w-0">
                  <input
                    type="checkbox"
                    :checked="selectedAliases.has(host.alias)"
                    @click.stop="toggleHost(host.alias)"
                    class="rounded border-theme bg-theme-input text-theme-accent focus:ring-theme-accent cursor-pointer"
                  />
                  <Server class="w-4 h-4 text-theme-accent shrink-0" />
                  <div class="truncate">
                    <div class="flex items-center space-x-1.5 truncate">
                      <span class="font-bold text-theme-main">{{ host.alias }}</span>
                      <span
                        v-if="host.is_duplicate"
                        class="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium shrink-0 flex items-center space-x-0.5"
                      >
                        <AlertTriangle class="w-2.5 h-2.5" />
                        <span>Ya existe</span>
                      </span>
                    </div>
                    <div class="text-[10px] text-theme-muted font-mono truncate">
                      {{ host.user ? host.user + '@' : '' }}{{ host.hostname }}:{{ host.port }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center space-x-1.5 shrink-0 text-[10px]">
                  <span
                    v-if="host.identity_file"
                    class="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono flex items-center space-x-1"
                    :title="host.identity_file"
                  >
                    <KeyRound class="w-2.5 h-2.5" />
                    <span class="max-w-[100px] truncate">{{ host.identity_file.split('/').pop() }}</span>
                  </span>
                  <span
                    v-if="host.proxy_jump"
                    class="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono flex items-center space-x-1"
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
          <div class="p-3.5 bg-theme-input border border-theme rounded-xl space-y-3">
            <div>
              <label class="block text-xs font-medium text-theme-muted mb-1 flex items-center space-x-1.5">
                <FolderInput class="w-3.5 h-3.5 text-theme-accent" />
                <span>Carpeta contenedora de importación</span>
              </label>
              <input
                v-model="folderName"
                type="text"
                placeholder="ej. Importados de SSH Config (o en blanco para raíz)"
                class="w-full px-3 py-1.5 bg-theme-surface border border-theme rounded-lg text-xs text-theme-main focus:outline-none focus:border-theme-accent transition"
              />
            </div>

            <div class="space-y-2 pt-1 border-t border-theme/60 text-xs">
              <label class="flex items-center space-x-2 text-theme-main cursor-pointer">
                <input
                  v-model="importKnownHosts"
                  type="checkbox"
                  class="rounded border-theme bg-theme-surface text-theme-accent focus:ring-theme-accent cursor-pointer"
                />
                <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
                <span>Pre-cargar claves de confianza desde <code>known_hosts</code> (evita alertas TOFU)</span>
              </label>

              <label class="flex items-center space-x-2 text-theme-main cursor-pointer">
                <input
                  v-model="overwriteDuplicates"
                  type="checkbox"
                  class="rounded border-theme bg-theme-surface text-theme-accent focus:ring-theme-accent cursor-pointer"
                />
                <AlertTriangle class="w-3.5 h-3.5 text-amber-400" />
                <span>Sobrescribir servidores duplicados si ya existen en la bóveda</span>
              </label>
            </div>
          </div>
        </div>

        <div v-if="error" class="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
          {{ error }}
        </div>
      </div>

      <!-- Footer Actions -->
      <div v-if="!importResult" class="px-5 py-3 border-t border-theme flex items-center justify-between bg-theme-header">
        <span class="text-xs text-theme-muted">
          {{ selectedAliases.size }} servidores listos para migrar
        </span>
        <div class="flex items-center space-x-2">
          <button
            type="button"
            @click="emit('close')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-medium text-theme-muted hover:text-theme-main hover:bg-theme-active transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            @click="handleImport"
            :disabled="isImporting || selectedAliases.size === 0"
            class="px-4 py-1.5 bg-theme-accent hover:opacity-90 text-slate-950 font-semibold rounded-xl text-xs shadow-md transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
          >
            <RefreshCw v-if="isImporting" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ isImporting ? 'Importando...' : 'Iniciar Importación' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
