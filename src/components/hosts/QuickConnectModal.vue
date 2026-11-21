<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useVaultStore } from "../../stores/vault.store";
import { useEnsureUnlocked } from "../../composables/useEnsureUnlocked";
import { useSnippetsStore } from "../../stores/snippets.store";
import type { HostSummary } from "../../types/inventory";
import type { CommandSnippet } from "../../types/snippets";
import { Search, Server, Terminal, Settings, Code, Folder, Tag, CornerDownLeft, ArrowRightLeft, FolderSync, Route } from "lucide-vue-next";

const props = defineProps<{
  isOpen: boolean;
  /** Texto inicial de búsqueda (p. ej. una IP detectada en la terminal). */
  prefill?: string | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "connect-host", host: HostSummary): void;
  (e: "connect-sftp", host: HostSummary): void;
  (e: "open-sftp"): void;
  (e: "open-local-pty"): void;
  (e: "open-settings"): void;
  (e: "open-snippets"): void;
  (e: "open-tunnels"): void;
  (e: "insert-command", command: string): void;
}>();

const { t } = useI18n();
const vaultStore = useVaultStore();
const { ensureUnlocked } = useEnsureUnlocked();
const snippetsStore = useSnippetsStore();
const query = ref("");
const selectedIndex = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);

interface SearchItem {
  type: "local" | "host" | "settings" | "snippet" | "tunnels" | "sftp";
  id: string;
  label: string;
  subtitle: string;
  folderName?: string;
  jumpHostLabel?: string;
  tags?: string[];
  host?: HostSummary;
  snippet?: CommandSnippet;
}

const items = computed<SearchItem[]>(() => {
  const result: SearchItem[] = [];
  const q = query.value.trim().toLowerCase();

  // Settings shortcut
  if (!q || "settings configuracion preferencias options theme idioma language".includes(q)) {
    result.push({
      type: "settings",
      id: "action-settings",
      label: t('settings.title'),
      subtitle: `${t('settings.tabs.general')} • ${t('settings.tabs.terminal')} • ${t('settings.tabs.security')}`,
    });
  }

  // SFTP shortcut
  if (!q || "sftp archivos files explorador explorer transferencias transfers".includes(q)) {
    result.push({
      type: "sftp",
      id: "action-sftp",
      label: "Explorador SFTP (Archivos Remotos)",
      subtitle: "Abrir gestor de archivos remotos y transferencias",
    });
  }

  // Tunnels shortcut
  if (!q || "tunnels tuneles port forwarding puertos socks5".includes(q)) {
    result.push({
      type: "tunnels",
      id: "action-tunnels",
      label: "Túneles SSH & Port Forwarding",
      subtitle: "Reenvío Local (-L), Remoto (-R) y SOCKS5 (-D)",
    });
  }

  // Always include local shell action if matches or empty query
  if (!q || "terminal local shell bash zsh".includes(q)) {
    result.push({
      type: "local",
      id: "action-local-pty",
      label: t('terminal.newLocal'),
      subtitle: "Zsh / Bash / Fish",
    });
  }

  // Find matching hosts
  for (const host of vaultStore.hosts) {
    const folder = vaultStore.folders.find((f) => f.id === host.folder_id);
    const folderName = folder ? folder.name : "";
    const tagsStr = host.tags.join(" ").toLowerCase();

    if (
      !q ||
      host.label.toLowerCase().includes(q) ||
      host.hostname.toLowerCase().includes(q) ||
      folderName.toLowerCase().includes(q) ||
      tagsStr.includes(q)
    ) {
      const jumpHost = host.jump_host_id ? vaultStore.hosts.find((h) => h.id === host.jump_host_id) : undefined;
      const jumpHostLabel = jumpHost ? jumpHost.label : undefined;

      result.push({
        type: "host",
        id: host.id,
        label: host.label,
        subtitle: `${host.hostname}:${host.port}`,
        folderName: folderName || undefined,
        jumpHostLabel,
        tags: host.tags,
        host,
      });
    }
  }

  // Find matching snippets
  for (const snip of snippetsStore.snippets) {
    const tagsStr = snip.tags.join(" ").toLowerCase();
    if (
      q &&
      (snip.title.toLowerCase().includes(q) ||
        snip.command_template.toLowerCase().includes(q) ||
        tagsStr.includes(q))
    ) {
      result.push({
        type: "snippet",
        id: "snip-" + snip.id,
        label: snip.title,
        subtitle: snip.command_template,
        tags: snip.tags,
        snippet: snip,
      });
    }
  }

  return result;
});

watch(items, () => {
  selectedIndex.value = 0;
});

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      query.value = props.prefill ?? "";
      selectedIndex.value = 0;
      nextTick(() => {
        searchInput.value?.focus();
      });
    }
  }
);

function handleKeyDown(e: KeyboardEvent) {
  if (!props.isOpen) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (items.value.length > 0) {
      selectedIndex.value = (selectedIndex.value + 1) % items.value.length;
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (items.value.length > 0) {
      selectedIndex.value = (selectedIndex.value - 1 + items.value.length) % items.value.length;
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    const item = items.value[selectedIndex.value];
    if (item) {
      executeItem(item);
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
  }
}

function executeItem(item: SearchItem) {
  if (item.type === "settings") {
    emit("open-settings");
  } else if (item.type === "sftp") {
    emit("open-sftp");
  } else if (item.type === "tunnels") {
    emit("open-tunnels");
  } else if (item.type === "local") {
    emit("open-local-pty");
  } else if (item.type === "snippet" && item.snippet) {
    const params = snippetsStore.extractParameters(item.snippet.command_template);
    if (params.length > 0) {
      emit("open-snippets");
    } else {
      emit("insert-command", item.snippet.command_template + "\n");
    }
  } else if (item.host) {
    emit("connect-host", item.host);
  }
  emit("close");
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <div
    v-if="isOpen"
    @click.self="emit('close')"
    class="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-xs p-4"
  >
    <div class="w-full max-w-xl bg-theme-surface border border-theme rounded-2xl shadow-2xl overflow-hidden flex flex-col text-theme-main transition-colors">
      <!-- Input header -->
      <div class="px-4 py-3 border-b border-theme flex items-center space-x-3 bg-theme-header">
        <Search class="w-5 h-5 text-theme-accent shrink-0" />
        <input
          ref="searchInput"
          v-model="query"
          type="text"
          placeholder="Escribe para buscar servidor, carpeta o comando rápido..."
          class="w-full bg-transparent text-sm text-theme-main placeholder-slate-500 focus:outline-none"
        />
        <kbd class="px-1.5 py-0.5 text-[10px] font-mono text-theme-muted bg-theme-app border border-theme rounded">
          ESC
        </kbd>
      </div>

      <!-- Bóveda bloqueada: los hosts guardados no están disponibles -->
      <button
        v-if="!vaultStore.isUnlocked"
        type="button"
        @click="ensureUnlocked(); emit('close')"
        class="w-full px-4 py-2 text-left text-xs text-amber-300 bg-amber-500/10 border-b border-theme hover:bg-amber-500/20 transition cursor-pointer"
      >
        {{ t('vault.quickConnectLocked') }}
      </button>

      <!-- Results list -->
      <div class="max-h-80 overflow-y-auto p-2 space-y-1 bg-theme-surface">
        <div
          v-for="(item, index) in items"
          :key="item.id"
          @click="executeItem(item)"
          @mouseenter="selectedIndex = index"
          class="flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs transition"
          :class="selectedIndex === index ? 'bg-theme-active text-theme-main border border-theme shadow-xs' : 'text-theme-muted hover:bg-theme-app/50 border border-transparent'"
        >
          <div class="flex items-center space-x-2.5 truncate">
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              :class="
                item.type === 'settings'
                  ? 'bg-blue-500/20 text-blue-400'
                  : item.type === 'sftp'
                  ? 'bg-amber-500/20 text-amber-400'
                  : item.type === 'snippet'
                  ? 'bg-amber-500/20 text-amber-400'
                  : item.type === 'tunnels'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : item.type === 'local'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-theme-active text-theme-accent'
              "
            >
              <Settings v-if="item.type === 'settings'" class="w-4 h-4" />
              <FolderSync v-else-if="item.type === 'sftp'" class="w-4 h-4" />
              <Code v-else-if="item.type === 'snippet'" class="w-4 h-4" />
              <ArrowRightLeft v-else-if="item.type === 'tunnels'" class="w-4 h-4" />
              <Terminal v-else-if="item.type === 'local'" class="w-4 h-4" />
              <Server v-else class="w-4 h-4" />
            </div>

            <div class="truncate">
              <div class="font-medium text-theme-main flex items-center space-x-2 truncate">
                <span>{{ item.label }}</span>
                <span
                  v-if="item.host?.protocol && item.host.protocol !== 'ssh'"
                  class="text-[10px] font-semibold uppercase px-1.5 py-0.2 bg-sky-500/15 text-sky-300 border border-sky-500/30 rounded"
                >{{ item.host.protocol }}</span>
                <span v-if="item.jumpHostLabel" class="text-[10px] px-1.5 py-0.2 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded flex items-center space-x-1">
                  <Route class="w-2.5 h-2.5 text-amber-400" />
                  <span>via {{ item.jumpHostLabel }}</span>
                </span>
                <span v-if="item.folderName" class="text-[10px] px-1.5 py-0.2 bg-theme-app text-theme-muted border border-theme rounded flex items-center space-x-1">
                  <Folder class="w-2.5 h-2.5" />
                  <span>{{ item.folderName }}</span>
                </span>
              </div>
              <div class="text-[10px] text-theme-muted font-mono truncate">
                {{ item.subtitle }}
              </div>
            </div>
          </div>

          <div class="flex items-center space-x-2 shrink-0">
            <button
              v-if="item.type === 'host' && item.host"
              @click.stop="emit('connect-sftp', item.host); emit('close');"
              class="p-1 px-1.5 rounded-md text-[10px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center space-x-1 cursor-pointer transition"
              title="Abrir SFTP directamente para este servidor"
            >
              <FolderSync class="w-3 h-3" />
              <span>SFTP</span>
            </button>
            <div v-if="item.tags && item.tags.length > 0" class="flex items-center space-x-1">
              <span
                v-for="tag in item.tags.slice(0, 2)"
                :key="tag"
                class="px-1.5 py-0.5 rounded bg-theme-app border border-theme text-[10px] text-theme-muted"
              >
                #{{ tag }}
              </span>
            </div>
            <CornerDownLeft v-if="selectedIndex === index" class="w-3.5 h-3.5 text-theme-accent" />
          </div>
        </div>

        <div v-if="items.length === 0" class="p-6 text-center text-xs text-slate-500">
          No se encontraron servidores o comandos que coincidan con "{{ query }}".
        </div>
      </div>

      <!-- Footer navigation hints -->
      <div class="px-4 py-2 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-[11px] text-slate-500">
        <div class="flex items-center space-x-3">
          <span class="flex items-center space-x-1">
            <kbd class="px-1 bg-slate-800 rounded border border-slate-700 font-mono text-[9px]">↑</kbd>
            <kbd class="px-1 bg-slate-800 rounded border border-slate-700 font-mono text-[9px]">↓</kbd>
            <span>Navegar</span>
          </span>
          <span class="flex items-center space-x-1">
            <kbd class="px-1 bg-slate-800 rounded border border-slate-700 font-mono text-[9px]">↵</kbd>
            <span>Conectar</span>
          </span>
        </div>
        <span>Paleta Rápida</span>
      </div>
    </div>
  </div>
</template>
