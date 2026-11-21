<script setup lang="ts">
import { useI18n } from "vue-i18n";
import BaseModal from "../common/BaseModal.vue";
import BaseButton from "../common/BaseButton.vue";
import { ref, watch, computed } from "vue";
import { useVaultStore } from "../../stores/vault.store";
import type { IdentitySummary, SaveIdentityPayload, AuthType } from "../../types/inventory";
import { X, KeyRound, Lock, User, Shield, Upload, Copy, Check, Sparkles } from "lucide-vue-next";
import { sessionService } from "../../services/session.service";
import CustomSelect, { type SelectOption } from "../common/CustomSelect.vue";

const { t } = useI18n();
const authTypeOptions = computed<SelectOption[]>(() => [
  {
    value: "password",
    label: t('ui.identity.password'),
    subtitle: t('ui.identity.passwordSub'),
    icon: Lock,
    iconColor: "text-accent",
  },
  {
    value: "private_key",
    label: t('ui.identity.sshKey'),
    subtitle: "Ed25519, RSA, ECDSA",
    icon: KeyRound,
    iconColor: "text-warning",
  },
  {
    value: "agent",
    label: t('ui.identity.agent'),
    subtitle: t('ui.identity.agentSub'),
    icon: Shield,
    iconColor: "text-info",
  },
]);

const genAlgorithmOptions = computed<SelectOption[]>(() => [
  {
    value: "ed25519",
    label: t('ui.identity.ed25519'),
  },
  {
    value: "rsa",
    label: t('ui.identity.rsa'),
  },
]);

const props = defineProps<{
  isOpen: boolean;
  identityToEdit?: IdentitySummary | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved", id: string): void;
}>();

const vaultStore = useVaultStore();

const name = ref("");
const username = ref("");
const authType = ref<AuthType>("password");
const secret = ref("");
const passphrase = ref("");
const publicKey = ref<string | null>(null);
const keyFingerprint = ref<string | null>(null);
const keyType = ref<string | null>(null);

const genAlgorithm = ref<"ed25519" | "rsa">("ed25519");
const isGeneratingKey = ref(false);
const copySuccess = ref(false);
const isSubmitting = ref(false);
const error = ref<string | null>(null);
const passphraseNotice = ref(false);

const fileInputRef = ref<HTMLInputElement | null>(null);

async function handleGenerateKey() {
  try {
    isGeneratingKey.value = true;
    error.value = null;
    passphraseNotice.value = false;
    const generated = await sessionService.generateSshKey(genAlgorithm.value);
    secret.value = generated.private_key;
    publicKey.value = generated.public_key;
    keyFingerprint.value = generated.fingerprint;
    keyType.value = genAlgorithm.value === "ed25519" ? "ssh-ed25519" : "ssh-rsa";
    if (!name.value) {
      const algLabel = genAlgorithm.value === "ed25519" ? "Ed25519" : "RSA 4096";
      name.value = `Llave ${algLabel} (${username.value || "root"})`;
    }
  } catch (err: any) {
    error.value = t('ui.identity.genError', { error: err?.message || err });
  } finally {
    isGeneratingKey.value = false;
  }
}

async function tryExtractPublicKey() {
  if (!secret.value.trim() || authType.value !== "private_key") return;

  try {
    error.value = null;
    passphraseNotice.value = false;
    const extracted = await sessionService.extractPublicKey(
      secret.value.trim(),
      passphrase.value.trim() || null
    );
    publicKey.value = extracted.public_key;
    keyFingerprint.value = extracted.fingerprint;
    keyType.value = extracted.key_type;

    if (!name.value) {
      name.value = `Llave ${extracted.key_type} (${username.value || "root"})`;
    }
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes("PASSPHRASE_REQUIRED")) {
      passphraseNotice.value = true;
    } else {
      // Input might still be incomplete while user is typing
      passphraseNotice.value = false;
    }
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target?.result as string;
    if (content) {
      secret.value = content;
      if (!name.value) {
        name.value = file.name.replace(/\.(pem|key|pub)$/i, "");
      }
      await tryExtractPublicKey();
    }
  };
  reader.readAsText(file);
  // Reset input so re-selecting same file triggers change
  target.value = "";
}

async function copyPublicKey() {
  if (publicKey.value) {
    await navigator.clipboard.writeText(publicKey.value);
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2500);
  }
}

watch(
  () => props.identityToEdit,
  (identity) => {
    if (identity) {
      name.value = identity.name;
      username.value = identity.username;
      authType.value = identity.auth_type;
      publicKey.value = identity.public_key || null;
      secret.value = "";
      passphrase.value = "";
      keyFingerprint.value = null;
      keyType.value = null;
    } else {
      name.value = "";
      username.value = "root";
      authType.value = "password";
      publicKey.value = null;
      secret.value = "";
      passphrase.value = "";
      keyFingerprint.value = null;
      keyType.value = null;
    }
    error.value = null;
    passphraseNotice.value = false;
  },
  { immediate: true }
);

async function handleSave() {
  if (!name.value.trim() || !username.value.trim()) {
    error.value = t('ui.identity.required');
    return;
  }

  isSubmitting.value = true;
  error.value = null;

  try {
    const payload: SaveIdentityPayload = {
      id: props.identityToEdit?.id,
      name: name.value.trim(),
      username: username.value.trim(),
      auth_type: authType.value,
      public_key: publicKey.value?.trim() || null,
      secret: secret.value.trim() ? secret.value.trim() : null,
      passphrase: passphrase.value.trim() ? passphrase.value.trim() : null,
    };

    const newId = await vaultStore.saveIdentity(payload);
    emit("saved", newId);
    emit("close");
  } catch (err: any) {
    error.value = typeof err === "string" ? err : err?.message || "Error al guardar la credencial.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <BaseModal v-if="isOpen" :title="identityToEdit ? t('ui.sidebar.editIdentity') : t('ui.identity.new')" size="md" @close="emit('close')">
    <template #icon><Shield class="w-4 h-4" /></template>

    <form id="identity-form" @submit.prevent="handleSave" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-fg-muted mb-1">{{ t('ui.identity.name') }}</label>
          <input
            v-model="name"
            type="text"
            required
            :placeholder="t('ui.identity.namePlaceholder')"
            class="w-full px-3 py-2 bg-app border border-line rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-fg-muted mb-1">{{ t('ui.identity.username') }}</label>
            <div class="relative">
              <User class="w-4 h-4 text-fg-muted absolute left-3 top-2.5" />
              <input
                v-model="username"
                type="text"
                required
                :placeholder="t('ui.identity.usernamePlaceholder')"
                class="w-full pl-9 pr-3 py-2 bg-app border border-line rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-fg-muted mb-1">{{ t('ui.identity.authMethod') }}</label>
            <CustomSelect
              v-model="authType"
              :options="authTypeOptions"
            />
          </div>
        </div>

        <!-- Password input -->
        <div v-if="authType === 'password'">
          <label class="block text-xs font-medium text-fg-muted mb-1">
            {{ t('ui.identity.password') }}
            <span v-if="identityToEdit?.has_secret" class="text-xs text-fg-muted font-normal">
              {{ t('ui.identity.keepExisting') }}
            </span>
          </label>
          <div class="relative">
            <Lock class="w-4 h-4 text-fg-muted absolute left-3 top-2.5" />
            <input
              v-model="secret"
              type="password"
              :placeholder="identityToEdit?.has_secret ? '••••••••••••' : t('ui.identity.passwordPlaceholder')"
              class="w-full pl-9 pr-3 py-2 bg-app border border-line rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
            />
          </div>
        </div>

        <!-- System Agent notice -->
        <div v-else-if="authType === 'agent'" class="p-3 bg-accent/15 border border-accent/30 rounded-xl space-y-1.5 text-xs text-accent">
          <div class="font-semibold flex items-center space-x-1.5">
            <Shield class="w-4 h-4 text-accent" />
            <span>{{ t('ui.identity.agentTitle') }}</span>
          </div>
          <p class="text-fg-muted text-[11px] leading-relaxed">
            {{ t('ui.identity.agentHelp') }}
          </p>
        </div>

        <!-- Private key input -->
        <div v-else-if="authType === 'private_key'" class="space-y-3">
          <!-- Toolbar: Import File & Generate Key -->
          <div class="p-2.5 bg-app/50 border border-line rounded-xl space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-fg">{{ t('ui.identity.keyTools') }}</span>
              <div class="flex items-center space-x-1.5">
                <!-- Hidden file input -->
                <input
                  ref="fileInputRef"
                  type="file"
                  class="hidden"
                  @change="handleFileSelect"
                  accept=".pub,.pem,.key,id_ed25519,id_rsa,*"
                />
                <button
                  type="button"
                  @click="fileInputRef?.click()"
                  class="px-2.5 py-1 bg-surface hover:bg-active border border-line text-fg rounded-lg text-[11px] font-medium flex items-center space-x-1 transition cursor-pointer"
                  :title="t('ui.identity.importTitle')"
                >
                  <Upload class="w-3.5 h-3.5 text-accent" />
                  <span>{{ t('ui.identity.importFile') }}</span>
                </button>
              </div>
            </div>

            <!-- Dual generator: ed25519 or rsa -->
            <div class="flex items-center space-x-2 pt-1 border-t border-line/60">
              <CustomSelect
                v-model="genAlgorithm"
                :options="genAlgorithmOptions"
                class="w-52"
              />
              <button
                type="button"
                @click="handleGenerateKey"
                :disabled="isGeneratingKey"
                class="px-2.5 py-2 bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent rounded-xl text-[11px] font-medium flex items-center space-x-1 transition cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Sparkles class="w-3.5 h-3.5" />
                <span>{{ isGeneratingKey ? 'Generando...' : 'Generar Llave' }}</span>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-fg-muted mb-1">
              {{ t('ui.identity.privateKey') }}
              <span v-if="identityToEdit?.has_secret" class="text-xs text-fg-muted font-normal">
                {{ t('ui.identity.keepExisting') }}
              </span>
            </label>
            <textarea
              v-model="secret"
              rows="4"
              @blur="tryExtractPublicKey"
              :placeholder="identityToEdit?.has_secret ? '-----BEGIN OPENSSH PRIVATE KEY-----\n[Encrypted in the local vault with AES-256-GCM]\n-----END OPENSSH PRIVATE KEY-----' : 'Pegue el contenido de id_ed25519 o id_rsa, o use Importar / Generar'"
              class="w-full px-3 py-2 bg-app border border-line rounded-xl text-xs font-mono text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
            ></textarea>
          </div>

          <!-- Passphrase Notice Alert -->
          <div v-if="passphraseNotice" class="p-2.5 bg-warning/15 border border-warning/30 rounded-xl text-xs text-warning">
            {{ t('ui.identity.passphraseNotice') }}
          </div>

          <div>
            <label class="block text-xs font-medium text-fg-muted mb-1">
              {{ t('ui.identity.passphrase') }}
            </label>
            <div class="relative">
              <KeyRound class="w-4 h-4 text-fg-muted absolute left-3 top-2.5" />
              <input
                v-model="passphrase"
                type="password"
                @blur="tryExtractPublicKey"
                :placeholder="t('ui.identity.passphrasePlaceholder')"
                class="w-full pl-9 pr-3 py-2 bg-app border border-line rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
              />
            </div>
          </div>

          <!-- Permanent Public Key Display with 1-click copy -->
          <div v-if="publicKey" class="p-3 bg-app/60 border border-line rounded-xl space-y-2">
            <div class="flex items-center justify-between text-xs text-fg font-medium">
              <span class="flex items-center space-x-1.5">
                <span class="text-accent font-semibold">{{ t('ui.identity.publicKey') }}</span>
                <span v-if="keyType" class="text-[10px] px-1.5 py-0.2 bg-active border border-line rounded text-fg-muted">
                  {{ keyType }}
                </span>
              </span>
              <button
                type="button"
                @click="copyPublicKey"
                class="px-2.5 py-1 rounded-lg bg-active hover:bg-app border border-line text-xs font-semibold text-accent flex items-center space-x-1 transition cursor-pointer"
                :title="t('ui.identity.copyTitle')"
              >
                <Check v-if="copySuccess" class="w-3.5 h-3.5 text-success" />
                <Copy v-else class="w-3.5 h-3.5" />
                <span>{{ copySuccess ? t('ui.identity.copied') : t('ui.identity.copy') }}</span>
              </button>
            </div>
            <div class="p-2 bg-app border border-line/60 rounded-lg font-mono text-[11px] text-fg break-all select-all">
              {{ publicKey }}
            </div>
            <div v-if="keyFingerprint" class="text-[10px] font-mono text-fg-muted">
              Fingerprint: {{ keyFingerprint }}
            </div>
          </div>
        </div>

        <div v-if="error" class="p-3 bg-danger/15 border border-danger/30 rounded-xl text-xs text-danger">
          {{ error }}
        </div>

        </form>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" variant="primary" :loading="isSubmitting" form="identity-form">
        {{ t('ui.identity.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
