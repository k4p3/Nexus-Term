# Diseño Técnico: Desbloqueo Perezoso de la Bóveda

## 1. Frontend
- `App.vue`: eliminar la rama `v-else-if="!isUnlocked"`; `TerminalWorkspace`, `HostTreeSidebar` y cabecera siempre montados. Si `ask_password_on_startup` es verdadero se mantiene la pantalla completa de desbloqueo antes del workspace (comportamiento actual).
- `VaultUnlockModal` (nuevo, `defineAsyncComponent`, en `src/components/vault/`): reutiliza la lógica de `VaultUnlockScreen` (modos `init` y `unlock`).
- `src/composables/useEnsureUnlocked.ts`: `ensureUnlocked(): Promise<boolean>`; si `vault.isUnlocked` resuelve de inmediato; si no, abre el modal y resuelve al desbloquear (`false` si se cancela). Cola única para evitar modales duplicados. Se invoca antes de abrir host/Quick Connect, SFTP, RDP/VNC, importar `ssh_config` y guardar host/identidad.
- `vault.store.ts`: `lock()` ya no limpia ni desmonta paneles; solo llama a `vault_lock` y vacía cachés de inventario/identidades. Las sesiones activas no dependen de `isUnlocked`.
- `HostTreeSidebar`: estado bloqueado ("Pulsa para desbloquear") y "bóveda no creada".
- `src/composables/useIdleLock.ts`: escucha `keydown`, `pointerdown`, `pointermove` (con throttle) y `focus`; reinicia un temporizador de `auto_lock_minutes`; al expirar llama a `vault.lock()`. Se activa solo si `auto_lock_enabled`.
- `useSessionRestore.ts`: la oferta tras un desbloqueo bajo demanda es un aviso no modal (`RestoreSessionsBanner`, estado `pendingInline`), no un diálogo apilado sobre el de la contraseña; con "pedir contraseña al iniciar" se mantiene el diálogo. Restaurar pestañas locales al arrancar; las remotas tras `isUnlocked`. `startupResolved` impide guardar el layout hasta decidir; el guardado automático ignora layouts parciales mientras haya remotas pendientes.

## 2. Backend (Rust)
- `VaultError::Locked` mantiene su mensaje con el código estable `VAULT_LOCKED:` al inicio. Como otras capas lo envuelven (p. ej. `Vault error: …`), el frontend lo detecta con una utilidad `isVaultLockedError` que busca el código como subcadena. Sin `unwrap`/`expect`.
- Sin cambios de gate en snippets, túneles (definiciones) ni ajustes.
- `AppSettings` (`settings.rs`): nuevos campos `ask_password_on_startup: bool` y `auto_lock_enabled: bool`; `auto_lock_minutes` ya existía (sin interfaz, 0 = desactivado) y pasa a valer 10 por defecto. En `sanitized()`, 0 heredado se convierte en 10 y el máximo es 1440. El JSON guardado antes del cambio recibe los nuevos valores por defecto.
- Las sesiones SSH/SFTP/telemetría ya autenticadas conservan su conexión; al bloquear no se consulta la clave de nuevo.

## 3. Contratos IPC
Sin comandos nuevos. Cambia solo el texto del error de `vault_*`/inventario/conexión y los campos de `get_app_settings`/`save_app_settings`. Tipos TS espejados en `src/types/`.

## 4. Seguridad
- La clave solo vive en Rust; el frontend nunca la almacena.
- Auto-bloqueo activo por defecto (10 min) para compensar la mayor permanencia de la clave en memoria.
- Reconexiones de sesiones remotas ya abiertas tras bloquear requieren desbloqueo (usan `create_authenticated_ssh_session`).

## 5. Pruebas
- Rust: `VaultError::Locked` con código estable; serialización de `AppSettings` con defaults y validación de `auto_lock_minutes`.
- Vitest: `useEnsureUnlocked` (ya desbloqueado, cola, cancelación), `useIdleLock` (temporizador con fake timers, desactivado), `vault.store` (`lock()` no toca sesiones), `useSessionRestore` (layout mixto), `isVaultLockedError`.
