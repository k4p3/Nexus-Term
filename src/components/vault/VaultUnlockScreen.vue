<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useVaultStore } from "../../stores/vault.store";
import { Lock, KeyRound, ShieldCheck, AlertCircle, Eye, EyeOff } from "lucide-vue-next";
import BaseButton from "../common/BaseButton.vue";

const emit = defineEmits<{ (e: "done"): void }>();
const { t } = useI18n();
const vaultStore = useVaultStore();

const password = ref("");
const showPassword = ref(false);
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
    <main class="w-full max-w-sm bg-surface border border-line rounded-modal p-7 shadow-2xl">
      <header class="flex items-start gap-3 mb-6">
        <div class="w-10 h-10 shrink-0 rounded-panel bg-accent text-on-accent flex items-center justify-center" aria-hidden="true">
          <KeyRound v-if="!vaultStore.isInitialized" class="w-5 h-5" />
          <Lock v-else class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <h1 class="text-lg font-semibold text-fg leading-tight">
            {{ !vaultStore.isInitialized ? t('vault.createTitle') : t('vault.unlockTitle') }}
          </h1>
          <p class="text-xs text-fg-muted mt-1 leading-relaxed">
            {{ !vaultStore.isInitialized ? t('vault.initPrompt') : t('vault.unlockPrompt') }}
          </p>
        </div>
      </header>

      <form @submit.prevent="handleAction" class="space-y-4">
        <div>
          <label for="vault-password" class="block text-xs font-medium text-fg mb-1.5">
            {{ t('vault.masterPassword') }}
          </label>
          <div class="relative">
            <input
              id="vault-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              :autocomplete="vaultStore.isInitialized ? 'current-password' : 'new-password'"
              autofocus
              class="w-full h-10 pl-3 pr-10 bg-app border border-line rounded-control text-sm text-fg placeholder-fg-muted focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent transition"
            />
            <button
              type="button"
              class="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-control text-fg-muted hover:text-fg cursor-pointer"
              :aria-label="showPassword ? t('vault.hidePassword') : t('vault.showPassword')"
              :title="showPassword ? t('vault.hidePassword') : t('vault.showPassword')"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" class="w-4 h-4" />
              <Eye v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div v-if="!vaultStore.isInitialized">
          <label for="vault-confirm" class="block text-xs font-medium text-fg mb-1.5">
            {{ t('vault.confirmPassword') }}
          </label>
          <input
            id="vault-confirm"
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            class="w-full h-10 px-3 bg-app border border-line rounded-control text-sm text-fg placeholder-fg-muted focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent transition"
          />
        </div>

        <div
          v-if="localError || vaultStore.error"
          role="alert"
          class="p-3 bg-danger/10 border border-danger/30 rounded-control flex items-start gap-2 text-xs text-danger"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-px" />
          <span>{{ localError || vaultStore.error }}</span>
        </div>

        <BaseButton type="submit" variant="primary" :loading="vaultStore.isLoading" class="w-full h-10 text-sm">
          {{ !vaultStore.isInitialized ? t('vault.createVault') : t('vault.unlock') }}
        </BaseButton>

        <p class="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <ShieldCheck class="w-3.5 h-3.5 text-success shrink-0" aria-hidden="true" />
          <span>{{ t('vault.encryptionNote') }}</span>
        </p>
      </form>
    </main>
  </div>
</template>
