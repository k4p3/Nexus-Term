<script setup lang="ts">
import { ref } from "vue";
import { useVaultStore } from "../../stores/vault.store";
import { Lock, KeyRound, ShieldCheck, AlertCircle, Loader2 } from "lucide-vue-next";

const vaultStore = useVaultStore();

const password = ref("");
const confirmPassword = ref("");
const localError = ref<string | null>(null);

async function handleAction() {
  localError.value = null;

  if (!password.value) {
    localError.value = "Por favor ingrese la contraseña maestra.";
    return;
  }

  if (!vaultStore.isInitialized) {
    if (password.value.length < 8) {
      localError.value = "La contraseña maestra debe tener al menos 8 caracteres.";
      return;
    }
    if (password.value !== confirmPassword.value) {
      localError.value = "Las contraseñas no coinciden.";
      return;
    }
    try {
      await vaultStore.init(password.value);
      password.value = "";
      confirmPassword.value = "";
    } catch (err: any) {
      localError.value = err;
    }
  } else {
    try {
      await vaultStore.unlock(password.value);
      password.value = "";
    } catch (err: any) {
      localError.value = err;
    }
  }
}
</script>

<template>
  <div class="h-full w-full flex items-center justify-center bg-slate-950 p-4">
    <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
      <!-- Decorative background glow -->
      <div class="absolute -top-16 -right-16 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-16 -left-16 w-44 h-44 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="text-center mb-6">
        <div class="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-3 shadow-inner">
          <KeyRound v-if="!vaultStore.isInitialized" class="w-8 h-8" />
          <Lock v-else class="w-8 h-8" />
        </div>
        <h2 class="text-2xl font-bold tracking-tight text-white">
          {{ !vaultStore.isInitialized ? 'Configurar Bóveda Cifrada' : 'Bóveda Protegida' }}
        </h2>
        <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          {{ !vaultStore.isInitialized 
            ? 'Crea una contraseña maestra para cifrar tus servidores y credenciales con Argon2id y AES-256-GCM.' 
            : 'Ingresa tu contraseña maestra para desbloquear tus conexiones e identidades.' }}
        </p>
      </div>

      <form @submit.prevent="handleAction" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">
            Contraseña Maestra
          </label>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            autofocus
            placeholder="••••••••••••"
            class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition shadow-sm"
          />
        </div>

        <div v-if="!vaultStore.isInitialized">
          <label class="block text-xs font-medium text-slate-300 mb-1.5">
            Confirmar Contraseña Maestra
          </label>
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••••••"
            class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition shadow-sm"
          />
        </div>

        <div v-if="localError || vaultStore.error" class="p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start space-x-2 text-xs text-red-300">
          <AlertCircle class="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          <span>{{ localError || vaultStore.error }}</span>
        </div>

        <button
          type="submit"
          :disabled="vaultStore.isLoading"
          class="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold rounded-xl text-sm shadow-lg shadow-cyan-500/20 transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Loader2 v-if="vaultStore.isLoading" class="w-4 h-4 animate-spin text-slate-950" />
          <span>
            {{ !vaultStore.isInitialized ? 'Crear e Inicializar Bóveda' : 'Desbloquear Bóveda' }}
          </span>
        </button>

        <div class="pt-2 flex items-center justify-center space-x-1.5 text-[11px] text-slate-500">
          <ShieldCheck class="w-3.5 h-3.5 text-cyan-400/80" />
          <span>Cifrado de grado militar de extremo a extremo en disco local</span>
        </div>
      </form>
    </div>
  </div>
</template>
