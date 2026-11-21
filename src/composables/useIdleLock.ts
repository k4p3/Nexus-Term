import { computed, onScopeDispose, watch } from "vue";
import { useSettingsStore } from "../stores/settings.store";
import { useVaultStore } from "../stores/vault.store";

const ACTIVITY_EVENTS = ["keydown", "pointerdown", "pointermove", "wheel", "focus"] as const;
/** Evita reprogramar el temporizador en cada evento de ratón. */
export const ACTIVITY_THROTTLE_MS = 1000;

/**
 * Bloquea la bóveda tras `auto_lock_minutes` sin entrada del usuario (teclado, ratón o foco).
 * La salida de las terminales NO cuenta como actividad. Debe llamarse dentro de `setup()`.
 */
export function useIdleLock() {
  const settings = useSettingsStore();
  const vault = useVaultStore();

  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastReset = 0;
  let listening = false;

  const minutes = computed(() => settings.settings.auto_lock_minutes);
  const active = computed(
    () => vault.isUnlocked && settings.settings.auto_lock_enabled && minutes.value > 0,
  );

  function arm() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (active.value) void vault.lock();
    }, minutes.value * 60_000);
  }

  function onActivity() {
    const now = Date.now();
    if (now - lastReset < ACTIVITY_THROTTLE_MS) return;
    lastReset = now;
    arm();
  }

  function start() {
    if (listening) return;
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { capture: true, passive: true });
    listening = true;
    lastReset = Date.now();
    arm();
  }

  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!listening) return;
    for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity, { capture: true });
    listening = false;
  }

  watch(
    [active, minutes],
    ([isActive]) => {
      stop(); // reinicia también cuando cambia la duración
      if (isActive) start();
    },
    { immediate: true },
  );

  onScopeDispose(stop);
}
