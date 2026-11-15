<script setup lang="ts">
import { ref, watch } from "vue";
import { useVaultStore } from "../../stores/vault.store";
import type { IdentitySummary, SaveIdentityPayload, AuthType } from "../../types/inventory";
import { X, KeyRound, Lock, User, Shield } from "lucide-vue-next";

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
const generatedPublicKey = ref<string | null>(null);
const isGeneratingKey = ref(false);
const copySuccess = ref(false);
const isSubmitting = ref(false);
const error = ref<string | null>(null);

import { sessionService } from "../../services/session.service";

async function handleGenerateKey() {
  try {
    isGeneratingKey.value = true;
    const generated = await sessionService.generateSshKey("ed25519");
    secret.value = generated.private_key;
    generatedPublicKey.value = generated.public_key;
    if (!name.value) {
      name.value = `Llave Ed25519 (${username.value || "root"})`;
    }
  } catch (err: any) {
    error.value = "Error al generar la llave SSH: " + err;
  } finally {
    isGeneratingKey.value = false;
  }
}

async function copyPublicKey() {
  if (generatedPublicKey.value) {
    await navigator.clipboard.writeText(generatedPublicKey.value);
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
      secret.value = "";
      passphrase.value = "";
    } else {
      name.value = "";
      username.value = "root";
      authType.value = "password";
      secret.value = "";
      passphrase.value = "";
    }
    error.value = null;
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
    <div class="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div class="flex items-center space-x-2">
          <Shield class="w-5 h-5 text-cyan-400" />
          <h3 class="text-sm font-bold text-white">
            {{ identityToEdit ? 'Editar Credencial' : 'Nueva Credencial SSH' }}
          </h3>
        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSave" class="p-5 space-y-4 overflow-y-auto flex-1">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Nombre Descriptivo</label>
          <input
            v-model="name"
            type="text"
            required
            placeholder="ej. Servidores Prod - Llave Primaria"
            class="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Usuario SSH</label>
            <div class="relative">
              <User class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                v-model="username"
                type="text"
                required
                placeholder="root / ubuntu / admin"
                class="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Método de Autenticación</label>
            <select
              v-model="authType"
              class="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
            >
              <option value="password">Contraseña</option>
              <option value="private_key">Llave Privada (Ed25519/RSA)</option>
              <option value="agent">Agente SSH del Sistema</option>
            </select>
          </div>
        </div>

        <!-- Password input -->
        <div v-if="authType === 'password'">
          <label class="block text-xs font-medium text-slate-300 mb-1">
            Contraseña
            <span v-if="identityToEdit?.has_secret" class="text-xs text-slate-500 font-normal">
              (Dejar en blanco para conservar la existente)
            </span>
          </label>
          <div class="relative">
            <Lock class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              v-model="secret"
              type="password"
              :placeholder="identityToEdit?.has_secret ? '••••••••••••' : 'Ingrese contraseña del servidor'"
              class="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
            />
          </div>
        </div>

        <!-- Private key input -->
        <div v-else-if="authType === 'private_key'" class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-medium text-slate-300">
              Contenido de la Llave Privada
              <span v-if="identityToEdit?.has_secret" class="text-xs text-slate-500 font-normal">
                (Dejar en blanco para conservar la existente)
              </span>
            </label>
            <button
              type="button"
              @click="handleGenerateKey"
              :disabled="isGeneratingKey"
              class="px-2.5 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 rounded-lg text-[11px] font-medium flex items-center space-x-1 transition cursor-pointer"
            >
              <span>⚡ Generar Ed25519</span>
            </button>
          </div>

          <div>
            <textarea
              v-model="secret"
              rows="4"
              :placeholder="identityToEdit?.has_secret ? '-----BEGIN OPENSSH PRIVATE KEY-----\n[Cifrada en bóveda local]\n-----END OPENSSH PRIVATE KEY-----' : 'Pegue el contenido de id_ed25519 o id_rsa, o pulsa en Generar Ed25519'"
              class="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
            ></textarea>
          </div>

          <!-- Generated Public Key Box -->
          <div v-if="generatedPublicKey" class="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-xl space-y-1.5">
            <div class="flex items-center justify-between text-xs text-cyan-300 font-medium">
              <span>Clave Pública Generada (agrega a ~/.ssh/authorized_keys):</span>
              <button
                type="button"
                @click="copyPublicKey"
                class="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-[10px] font-semibold text-cyan-200 transition"
              >
                {{ copySuccess ? '¡Copiada!' : 'Copiar' }}
              </button>
            </div>
            <div class="p-2 bg-slate-950 rounded-lg font-mono text-[10px] text-slate-300 break-all select-all">
              {{ generatedPublicKey }}
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">
              Passphrase de la Llave (Opcional)
            </label>
            <div class="relative">
              <KeyRound class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                v-model="passphrase"
                type="password"
                placeholder="Si la llave está protegida con contraseña"
                class="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
              />
            </div>
          </div>
        </div>

        <div v-if="error" class="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
          {{ error }}
        </div>

        <!-- Actions -->
        <div class="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
          <button
            type="button"
            @click="emit('close')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-xl text-xs shadow-md shadow-cyan-500/20 transition disabled:opacity-50"
          >
            Guardar Credencial
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
