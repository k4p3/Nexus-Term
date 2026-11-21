<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useVaultStore } from "../../stores/vault.store";
import { Lock, KeyRound, ShieldCheck, AlertCircle, Loader2 } from "lucide-vue-next";

const emit = defineEmits<{ (e: "done"): void }>();
const { t } = useI18n();
const vaultStore = useVaultStore();

const password = ref("");
const confirmPassword = ref("");
const localError = ref<string | null>(null);

async function handleAction() {
  localError.value = null;

  if (!password.value) {
    localError.value = t('vault.emptyPassword');
    return;
  }

  if (!vaultStore.isInitialized) {
    if (password.value.length < 8) {
      localError.value = "La contraseña debe tener al menos 8 caracteres / Password must be at least 8 characters.";
      return;
    }
    if (password.value !== confirmPassword.value) {
      localError.value = t('vault.mismatchPassword');
      return;
    }
    try {
      await vaultStore.init(password.value);
      password.value = "";
      confirmPassword.value = "";
      emit("done");
    } catch (err: any) {
      localError.value = err;
    }
  } else {
    try {
      await vaultStore.unlock(password.value);
      password.value = "";
      emit("done");
    } catch (err: any) {
      localError.value = err;
    }
  }
}
</script>

<template>
  <div class="h-full w-full flex items-center justify-center bg-app p-4">
    <div class="w-full max-w-md bg-surface border border-line rounded-2xl p-8 shadow-2xl relative overflow-hidden">
      <!-- Decorative background glow -->
      <div class="absolute -top-16 -right-16 w-44 h-44 bg-accent/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-16 -left-16 w-44 h-44 bg-accent/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="text-center mb-6">
        <div class="inline-flex p-3 rounded-2xl bg-accent/10 border border-accent/20 text-accent mb-3 shadow-inner">
          <KeyRound v-if="!vaultStore.isInitialized" class="w-8 h-8" />
          <Lock v-else class="w-8 h-8" />
        </div>
        <h2 class="text-2xl font-bold tracking-tight text-fg">
          {{ !vaultStore.isInitialized ? t('vault.createTitle') : t('vault.unlockTitle') }}
        </h2>
        <p class="text-xs text-fg-muted mt-1 max-w-xs mx-auto">
          {{ !vaultStore.isInitialized ? t('vault.initPrompt') : t('vault.unlockPrompt') }}
        </p>
      </div>

      <form @submit.prevent="handleAction" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-fg mb-1.5">
            {{ t('vault.masterPassword') }}
          </label>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            autofocus
            placeholder="••••••••••••"
            class="w-full px-3.5 py-2.5 bg-app border border-line/80 rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent transition shadow-xs"
          />
        </div>

        <div v-if="!vaultStore.isInitialized">
          <label class="block text-xs font-medium text-fg mb-1.5">
            {{ t('vault.confirmPassword') }}
          </label>
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••••••"
            class="w-full px-3.5 py-2.5 bg-app border border-line/80 rounded-xl text-sm text-fg placeholder-fg-muted focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent transition shadow-xs"
          />
        </div>

        <div v-if="localError || vaultStore.error" class="p-3 bg-danger/40 border border-danger/60 rounded-xl flex items-start space-x-2 text-xs text-danger">
          <AlertCircle class="w-4 h-4 shrink-0 text-danger mt-0.5" />
          <span>{{ localError || vaultStore.error }}</span>
        </div>

        <button
          type="submit"
          :disabled="vaultStore.isLoading"
          class="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-on-accent font-semibold rounded-xl text-sm shadow-lg shadow-accent/20 transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Loader2 v-if="vaultStore.isLoading" class="w-4 h-4 animate-spin text-on-accent" />
          <span>
            {{ !vaultStore.isInitialized ? t('vault.createVault') : t('vault.unlock') }}
          </span>
        </button>

        <div class="pt-2 flex items-center justify-center space-x-1.5 text-[11px] text-fg-muted">
          <ShieldCheck class="w-3.5 h-3.5 text-accent/80" />
          <span>Argon2id + AES-256-GCM Zero-Knowledge</span>
        </div>
      </form>
    </div>
  </div>
</template>
