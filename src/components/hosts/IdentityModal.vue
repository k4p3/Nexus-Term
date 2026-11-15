<script setup lang="ts">
import { ref, watch } from "vue";
import { useVaultStore } from "../../stores/vault.store";
import type { IdentitySummary, SaveIdentityPayload, AuthType } from "../../types/inventory";
import { X, KeyRound, Lock, User, Shield, Upload, Copy, Check, Sparkles } from "lucide-vue-next";
import { sessionService } from "../../services/session.service";

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
    error.value = "Error al generar la llave SSH: " + (err?.message || err);
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
    error.value = "Nombre y usuario son obligatorios.";
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
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
    <div class="w-full max-w-lg bg-theme-surface border border-theme rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="px-5 py-3.5 border-b border-theme flex items-center justify-between bg-theme-app/50">
        <div class="flex items-center space-x-2">
          <Shield class="w-5 h-5 text-theme-accent" />
          <h3 class="text-sm font-bold text-theme-main">
            {{ identityToEdit ? 'Editar Credencial' : 'Nueva Credencial SSH' }}
          </h3>
        </div>
        <button @click="emit('close')" class="text-theme-muted hover:text-theme-main p-1 rounded-lg hover:bg-theme-active transition cursor-pointer">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSave" class="p-5 space-y-4 overflow-y-auto flex-1">
        <div>
          <label class="block text-xs font-medium text-theme-muted mb-1">Nombre Descriptivo</label>
          <input
            v-model="name"
            type="text"
            required
            placeholder="ej. Servidores Prod - Llave Primaria"
            class="w-full px-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main placeholder-theme-muted focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-theme-muted mb-1">Usuario SSH</label>
            <div class="relative">
              <User class="w-4 h-4 text-theme-muted absolute left-3 top-2.5" />
              <input
                v-model="username"
                type="text"
                required
                placeholder="root / ubuntu / admin"
                class="w-full pl-9 pr-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main placeholder-theme-muted focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-theme-muted mb-1">Método de Autenticación</label>
            <select
              v-model="authType"
              class="w-full px-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
            >
              <option value="password">Contraseña</option>
              <option value="private_key">Llave SSH (Ed25519 / RSA)</option>
              <option value="agent">Agente SSH del Sistema (SSH_AUTH_SOCK)</option>
            </select>
          </div>
        </div>

        <!-- Password input -->
        <div v-if="authType === 'password'">
          <label class="block text-xs font-medium text-theme-muted mb-1">
            Contraseña
            <span v-if="identityToEdit?.has_secret" class="text-xs text-theme-muted font-normal">
              (Dejar en blanco para conservar la existente)
            </span>
          </label>
          <div class="relative">
            <Lock class="w-4 h-4 text-theme-muted absolute left-3 top-2.5" />
            <input
              v-model="secret"
              type="password"
              :placeholder="identityToEdit?.has_secret ? '••••••••••••' : 'Ingrese contraseña del servidor'"
              class="w-full pl-9 pr-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main placeholder-theme-muted focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
            />
          </div>
        </div>

        <!-- System Agent notice -->
        <div v-else-if="authType === 'agent'" class="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl space-y-1.5 text-xs text-cyan-200">
          <div class="font-semibold flex items-center space-x-1.5">
            <Shield class="w-4 h-4 text-theme-accent" />
            <span>Autenticación por Agente del Sistema</span>
          </div>
          <p class="text-theme-muted text-[11px] leading-relaxed">
            NexusTerm delegará la firma criptográfica al socket local de su agente SSH (<code>SSH_AUTH_SOCK</code> en Linux/macOS o Pageant/OpenSSH en Windows). Compatible con YubiKey, llaves de hardware FIDO2 y 1Password.
          </p>
        </div>

        <!-- Private key input -->
        <div v-else-if="authType === 'private_key'" class="space-y-3">
          <!-- Toolbar: Import File & Generate Key -->
          <div class="p-2.5 bg-theme-app/50 border border-theme rounded-xl space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-theme-main">Herramientas de Llaves</span>
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
                  class="px-2.5 py-1 bg-theme-surface hover:bg-theme-active border border-theme text-theme-main rounded-lg text-[11px] font-medium flex items-center space-x-1 transition cursor-pointer"
                  title="Importar archivo id_ed25519, id_rsa, .pem o .pub"
                >
                  <Upload class="w-3.5 h-3.5 text-theme-accent" />
                  <span>Importar Archivo</span>
                </button>
              </div>
            </div>

            <!-- Dual generator: ed25519 or rsa -->
            <div class="flex items-center space-x-2 pt-1 border-t border-theme/60">
              <select
                v-model="genAlgorithm"
                class="px-2 py-1 bg-theme-input border border-theme rounded-lg text-xs text-theme-main focus:outline-none focus:border-theme-accent"
              >
                <option value="ed25519">Ed25519 (Recomendado)</option>
                <option value="rsa">RSA (4096 bits)</option>
              </select>
              <button
                type="button"
                @click="handleGenerateKey"
                :disabled="isGeneratingKey"
                class="px-2.5 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 rounded-lg text-[11px] font-medium flex items-center space-x-1 transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles class="w-3 h-3" />
                <span>{{ isGeneratingKey ? 'Generando...' : 'Generar Llave' }}</span>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-theme-muted mb-1">
              Contenido de la Llave Privada
              <span v-if="identityToEdit?.has_secret" class="text-xs text-theme-muted font-normal">
                (Dejar en blanco para conservar la existente)
              </span>
            </label>
            <textarea
              v-model="secret"
              rows="4"
              @blur="tryExtractPublicKey"
              :placeholder="identityToEdit?.has_secret ? '-----BEGIN OPENSSH PRIVATE KEY-----\n[Cifrada en bóveda local con AES-256-GCM]\n-----END OPENSSH PRIVATE KEY-----' : 'Pegue el contenido de id_ed25519 o id_rsa, o use Importar / Generar'"
              class="w-full px-3 py-2 bg-theme-input border border-theme rounded-xl text-xs font-mono text-theme-main placeholder-theme-muted focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
            ></textarea>
          </div>

          <!-- Passphrase Notice Alert -->
          <div v-if="passphraseNotice" class="p-2.5 bg-amber-950/40 border border-amber-700/50 rounded-xl text-xs text-amber-200">
            ⚠️ Esta llave privada está protegida por frase de paso. Ingrese la <strong>Passphrase</strong> abajo para descifrarla y derivar su clave pública.
          </div>

          <div>
            <label class="block text-xs font-medium text-theme-muted mb-1">
              Passphrase de la Llave (Opcional)
            </label>
            <div class="relative">
              <KeyRound class="w-4 h-4 text-theme-muted absolute left-3 top-2.5" />
              <input
                v-model="passphrase"
                type="password"
                @blur="tryExtractPublicKey"
                placeholder="Si la llave está protegida con contraseña"
                class="w-full pl-9 pr-3 py-2 bg-theme-input border border-theme rounded-xl text-sm text-theme-main placeholder-theme-muted focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent transition"
              />
            </div>
          </div>

          <!-- Permanent Public Key Display with 1-click copy -->
          <div v-if="publicKey" class="p-3 bg-theme-app/60 border border-theme rounded-xl space-y-2">
            <div class="flex items-center justify-between text-xs text-theme-main font-medium">
              <span class="flex items-center space-x-1.5">
                <span class="text-theme-accent font-semibold">Clave Pública OpenSSH</span>
                <span v-if="keyType" class="text-[10px] px-1.5 py-0.2 bg-theme-active border border-theme rounded text-theme-muted">
                  {{ keyType }}
                </span>
              </span>
              <button
                type="button"
                @click="copyPublicKey"
                class="px-2.5 py-1 rounded-lg bg-theme-active hover:bg-theme-input border border-theme text-xs font-semibold text-theme-accent flex items-center space-x-1 transition cursor-pointer"
                title="Copiar para ~/.ssh/authorized_keys"
              >
                <Check v-if="copySuccess" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5" />
                <span>{{ copySuccess ? '¡Copiada!' : 'Copiar Clave' }}</span>
              </button>
            </div>
            <div class="p-2 bg-theme-input border border-theme/60 rounded-lg font-mono text-[11px] text-theme-main break-all select-all">
              {{ publicKey }}
            </div>
            <div v-if="keyFingerprint" class="text-[10px] font-mono text-theme-muted">
              Fingerprint: {{ keyFingerprint }}
            </div>
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
            class="px-4 py-1.5 bg-theme-accent hover:opacity-90 text-slate-950 font-semibold rounded-xl text-xs shadow-md transition cursor-pointer disabled:opacity-50"
          >
            Guardar Credencial
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
