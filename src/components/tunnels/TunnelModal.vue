<script setup lang="ts">
import { useI18n } from "vue-i18n";
import BaseModal from "../common/BaseModal.vue";
import BaseButton from "../common/BaseButton.vue";
import { ref, watch, computed } from "vue";
import { useVaultStore } from "../../stores/vault.store";
import type { TunnelConfig, TunnelConfigPayload, TunnelType } from "../../types/tunnels";
import { X, Network, Server, ArrowRightLeft, ShieldAlert } from "lucide-vue-next";
import CustomSelect, { type SelectOption } from "../common/CustomSelect.vue";

const { t } = useI18n();
const props = defineProps<{
  isOpen: boolean;
  tunnelToEdit?: TunnelConfig | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", payload: TunnelConfigPayload): void;
}>();

const vaultStore = useVaultStore();

const name = ref("");
const hostId = ref("");
const tunnelType = ref<TunnelType>("local");
const localHost = ref("127.0.0.1");
const localPort = ref<number | null>(null);
const remoteHost = ref("127.0.0.1");
const remotePort = ref<number | null>(null);
const autoStart = ref(false);
const error = ref("");

const availableHosts = computed(() => vaultStore.hosts);
const hostOptions = computed<SelectOption[]>(() => {
  return vaultStore.hosts.map((h) => ({
    value: h.id,
    label: h.label,
    subtitle: `${h.hostname}:${h.port}`,
    icon: Server,
    iconColor: "text-accent",
  }));
});

watch(
  () => props.tunnelToEdit,
  (item) => {
    if (item) {
      name.value = item.name;
      hostId.value = item.host_id;
      tunnelType.value = item.tunnel_type;
      localHost.value = item.local_host;
      localPort.value = item.local_port;
      remoteHost.value = item.remote_host || "127.0.0.1";
      remotePort.value = item.remote_port || null;
      autoStart.value = item.auto_start;
    } else {
      name.value = "";
      hostId.value = availableHosts.value[0]?.id || "";
      tunnelType.value = "local";
      localHost.value = "127.0.0.1";
      localPort.value = null;
      remoteHost.value = "127.0.0.1";
      remotePort.value = null;
      autoStart.value = false;
    }
    error.value = "";
  },
  { immediate: true }
);

function handleSubmit() {
  if (!name.value.trim()) {
    error.value = t('ui.tunnelForm.nameRequired');
    return;
  }
  if (!hostId.value) {
    error.value = t('ui.tunnelForm.hostRequired');
    return;
  }
  if (!localPort.value || localPort.value < 1 || localPort.value > 65535) {
    error.value = t('ui.tunnelForm.localPortRange');
    return;
  }
  if (tunnelType.value !== "dynamic") {
    if (!remoteHost.value.trim()) {
      error.value = t('ui.tunnelForm.remoteHostRequired');
      return;
    }
    if (!remotePort.value || remotePort.value < 1 || remotePort.value > 65535) {
      error.value = t('ui.tunnelForm.remotePortRange');
      return;
    }
  }

  emit("save", {
    id: props.tunnelToEdit?.id,
    host_id: hostId.value,
    name: name.value.trim(),
    tunnel_type: tunnelType.value,
    local_host: localHost.value.trim() || "127.0.0.1",
    local_port: localPort.value,
    remote_host: tunnelType.value === "dynamic" ? null : remoteHost.value.trim(),
    remote_port: tunnelType.value === "dynamic" ? null : remotePort.value,
    auto_start: autoStart.value,
  });
  emit("close");
}
</script>

<template>
  <BaseModal v-if="isOpen" :title="tunnelToEdit ? t('ui.tunnelForm.edit') : t('ui.tunnelForm.newTitle')" size="md" @close="emit('close')">
    <template #icon><ArrowRightLeft class="w-4 h-4" /></template>

    <form id="tunnel-form" @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Error Banner -->
        <div
          v-if="error"
          class="flex items-center space-x-2 p-2.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs"
        >
          <ShieldAlert class="w-4 h-4 shrink-0" />
          <span>{{ error }}</span>
        </div>

        <!-- Name & Host -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] font-medium text-fg mb-1">{{ t('ui.tunnelForm.name') }}</label>
            <input
              v-model="name"
              type="text"
              :placeholder="t('ui.tunnelForm.namePlaceholder')"
              class="w-full px-3 py-1.5 bg-app/60 border border-line rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent transition"
              required
            />
          </div>

          <div>
            <label class="block text-[11px] font-medium text-fg mb-1">{{ t('ui.tunnelForm.host') }}</label>
            <CustomSelect
              v-model="hostId"
              :options="hostOptions"
              :placeholder="t('ui.tunnelForm.hostPlaceholder')"
            />
          </div>
        </div>

        <!-- Tunnel Type Selector -->
        <div>
          <label class="block text-[11px] font-medium text-fg mb-1.5">{{ t('ui.tunnelForm.type') }}</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              @click="tunnelType = 'local'"
              class="px-3 py-2 rounded-lg border text-left transition cursor-pointer"
              :class="
                tunnelType === 'local'
                  ? 'bg-accent/15 border-accent/40 text-accent shadow-xs'
                  : 'bg-app/40 border-line text-fg-muted hover:text-fg'
              "
            >
              <div class="font-medium text-xs">Local (-L)</div>
              <div class="text-[10px] opacity-75">{{ t('ui.tunnelForm.localToRemote') }}</div>
            </button>

            <button
              type="button"
              @click="tunnelType = 'remote'"
              class="px-3 py-2 rounded-lg border text-left transition cursor-pointer"
              :class="
                tunnelType === 'remote'
                  ? 'bg-accent/15 border-accent/40 text-accent shadow-xs'
                  : 'bg-app/40 border-line text-fg-muted hover:text-fg'
              "
            >
              <div class="font-medium text-xs">Remoto (-R)</div>
              <div class="text-[10px] opacity-75">{{ t('ui.tunnelForm.remoteToLocal') }}</div>
            </button>

            <button
              type="button"
              @click="tunnelType = 'dynamic'"
              class="px-3 py-2 rounded-lg border text-left transition cursor-pointer"
              :class="
                tunnelType === 'dynamic'
                  ? 'bg-success/15 border-success/40 text-success shadow-xs'
                  : 'bg-app/40 border-line text-fg-muted hover:text-fg'
              "
            >
              <div class="font-medium text-xs">SOCKS5 (-D)</div>
              <div class="text-[10px] opacity-75">{{ t('ui.tunnelForm.dynamic') }}</div>
            </button>
          </div>
        </div>

        <!-- Port Configurations -->
        <div class="p-3.5 rounded-xl bg-app/40 border border-line/80 space-y-3">
          <!-- Local Bind -->
          <div class="grid grid-cols-3 gap-2">
            <div class="col-span-2">
              <label class="block text-[10px] font-medium text-fg-muted mb-1">
                {{ tunnelType === 'remote' ? 'Destino Local' : 'Host en Escucha Local' }}
              </label>
              <input
                v-model="localHost"
                type="text"
                placeholder="127.0.0.1"
                class="w-full px-2.5 py-1.5 bg-surface border border-line/80 rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent font-mono transition"
                required
              />
            </div>
            <div>
              <label class="block text-[10px] font-medium text-fg-muted mb-1">{{ t('ui.tunnelForm.localPort') }}</label>
              <input
                v-model.number="localPort"
                type="number"
                min="1"
                max="65535"
                placeholder="ej. 5433"
                class="w-full px-2.5 py-1.5 bg-surface border border-line/80 rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent font-mono transition"
                required
              />
            </div>
          </div>

          <!-- Remote Destination (if not dynamic) -->
          <div v-if="tunnelType !== 'dynamic'" class="grid grid-cols-3 gap-2 pt-1 border-t border-line/60">
            <div class="col-span-2">
              <label class="block text-[10px] font-medium text-fg-muted mb-1">
                {{ tunnelType === 'remote' ? 'Host Remoto en Escucha' : 'Destino Remoto' }}
              </label>
              <input
                v-model="remoteHost"
                type="text"
                :placeholder="t('ui.tunnelForm.remoteHostPlaceholder')"
                class="w-full px-2.5 py-1.5 bg-surface border border-line/80 rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent font-mono transition"
                required
              />
            </div>
            <div>
              <label class="block text-[10px] font-medium text-fg-muted mb-1">{{ t('ui.tunnelForm.remotePort') }}</label>
              <input
                v-model.number="remotePort"
                type="number"
                min="1"
                max="65535"
                placeholder="ej. 5432"
                class="w-full px-2.5 py-1.5 bg-surface border border-line/80 rounded-lg text-xs text-fg focus:outline-hidden focus:border-accent font-mono transition"
                required
              />
            </div>
          </div>

          <div v-else class="text-[11px] text-success/90 flex items-center space-x-1.5 pt-1">
            <Network class="w-3.5 h-3.5 shrink-0" />
            <span>{{ t('ui.tunnelForm.socksReady', { port: localPort || 'XXXX' }) }}</span>
          </div>
        </div>

        </form>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" variant="primary" form="tunnel-form">
        {{ tunnelToEdit ? t('ui.tunnelForm.update') : t('ui.tunnelForm.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
