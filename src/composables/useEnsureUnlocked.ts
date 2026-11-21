import { ref } from "vue";
import { useVaultStore } from "../stores/vault.store";
import { isVaultLockedError } from "../utils/vault-errors";

// Estado compartido: solo puede haber un modal de desbloqueo a la vez.
const promptOpen = ref(false);
let pending: Promise<boolean> | null = null;
let settle: ((ok: boolean) => void) | null = null;

/** Solo para pruebas. */
export function __resetEnsureUnlocked() {
  promptOpen.value = false;
  pending = null;
  settle = null;
}

export function useEnsureUnlocked() {
  const vault = useVaultStore();

  /** Resuelve a `true` cuando la bóveda está desbloqueada; abre el modal si hace falta (`false` si se cancela). */
  function ensureUnlocked(): Promise<boolean> {
    if (vault.isUnlocked) return Promise.resolve(true);
    if (pending) return pending;
    pending = new Promise<boolean>((resolve) => {
      settle = resolve;
      promptOpen.value = true;
    });
    return pending;
  }

  /** Lo llama el modal al desbloquear/crear (`true`) o al cancelar (`false`). */
  function resolvePrompt(ok: boolean) {
    promptOpen.value = false;
    const done = settle;
    pending = null;
    settle = null;
    done?.(ok);
  }

  /**
   * Ejecuta `fn`; si falla porque la bóveda está bloqueada, pide el desbloqueo y reintenta una vez.
   * Devuelve `undefined` si el usuario cancela el desbloqueo.
   */
  async function runWithUnlock<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (!(await ensureUnlocked())) return undefined;
    try {
      return await fn();
    } catch (err) {
      if (!isVaultLockedError(err)) throw err;
      // El backend es la fuente de verdad: si dice "bloqueada", el estado local estaba desfasado.
      vault.isUnlocked = false;
      if (!(await ensureUnlocked())) return undefined;
      return await fn();
    }
  }

  return { ensureUnlocked, resolvePrompt, runWithUnlock, promptOpen };
}
