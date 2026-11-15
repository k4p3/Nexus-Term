<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useVaultStore } from "../../stores/vault.store";
import type { HostSummary } from "../../types/inventory";
import { Search, Server, Terminal, Settings, Folder, Tag, CornerDownLeft } from "lucide-vue-next";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "connect-host", host: HostSummary): void;
  (e: "open-local-pty"): void;
  (e: "open-settings"): void;
}>();

const { t } = useI18n();
const vaultStore = useVaultStore();
const query = ref("");
const selectedIndex = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);

interface SearchItem {
  type: "local" | "host" | "settings";
  id: string;
  label: string;
  subtitle: string;
  folderName?: string;
  tags?: string[];
  host?: HostSummary;
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
      result.push({
        type: "host",
        id: host.id,
        label: host.label,
        subtitle: `${host.hostname}:${host.port}`,
        folderName: folderName || undefined,
        tags: host.tags,
        host,
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
      query.value = "";
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
  } else if (item.type === "local") {
    emit("open-local-pty");
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
    <div class="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      <!-- Input header -->
      <div class="px-4 py-3 border-b border-slate-800 flex items-center space-x-3 bg-slate-950/60">
        <Search class="w-5 h-5 text-cyan-400 shrink-0" />
        <input
          ref="searchInput"
          v-model="query"
          type="text"
          placeholder="Escribe para buscar servidor, carpeta o comando rápido..."
          class="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
        />
        <kbd class="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded">
          ESC
        </kbd>
      </div>

      <!-- Results list -->
      <div class="max-h-80 overflow-y-auto p-2 space-y-1">
        <div
          v-for="(item, index) in items"
          :key="item.id"
          @click="executeItem(item)"
          @mouseenter="selectedIndex = index"
          class="flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs transition"
          :class="selectedIndex === index ? 'bg-cyan-500/15 text-white border border-cyan-500/30' : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'"
        >
          <div class="flex items-center space-x-2.5 truncate">
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              :class="item.type === 'settings' ? 'bg-blue-500/20 text-blue-400' : item.type === 'local' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'"
            >
              <Settings v-if="item.type === 'settings'" class="w-4 h-4" />
              <Terminal v-else-if="item.type === 'local'" class="w-4 h-4" />
              <Server v-else class="w-4 h-4" />
            </div>

            <div class="truncate">
              <div class="font-medium text-slate-100 flex items-center space-x-2 truncate">
                <span>{{ item.label }}</span>
                <span v-if="item.folderName" class="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded flex items-center space-x-1">
                  <Folder class="w-2.5 h-2.5" />
                  <span>{{ item.folderName }}</span>
                </span>
              </div>
              <div class="text-[10px] text-slate-400 font-mono truncate">
                {{ item.subtitle }}
              </div>
            </div>
          </div>

          <div class="flex items-center space-x-2 shrink-0">
            <div v-if="item.tags && item.tags.length > 0" class="flex items-center space-x-1">
              <span
                v-for="tag in item.tags.slice(0, 2)"
                :key="tag"
                class="px-1.5 py-0.5 rounded bg-slate-800/80 text-[10px] text-slate-400"
              >
                #{{ tag }}
              </span>
            </div>
            <CornerDownLeft v-if="selectedIndex === index" class="w-3.5 h-3.5 text-cyan-400" />
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
