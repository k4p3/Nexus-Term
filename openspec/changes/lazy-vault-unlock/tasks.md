# Tareas: Desbloqueo Perezoso de la Bóveda

## 1. Backend
- [x] 1.1 Añadir código estable `VAULT_LOCKED:` a `VaultError::Locked` y pruebas unitarias
- [x] 1.2 Añadir `ask_password_on_startup`, `auto_lock_enabled`, `auto_lock_minutes` a `AppSettings` con defaults y validación (≥ 1) + pruebas
- [x] 1.3 Verificar que ninguna ruta de sesiones ya abiertas consulta la clave de la bóveda al bloquear

## 2. Frontend: núcleo
- [x] 2.1 Utilidad `isVaultLockedError` y tipos TS de los nuevos ajustes + pruebas
- [x] 2.2 Composable `useEnsureUnlocked` y `VaultUnlockModal` (lazy) + pruebas
- [x] 2.3 Cambiar `vault.store.lock()` para conservar sesiones y paneles + pruebas
- [x] 2.4 Composable `useIdleLock` + pruebas con temporizadores simulados

## 3. Frontend: integración
- [x] 3.1 `App.vue`: workspace siempre montado, pestaña local inicial, modo "pedir al iniciar"
- [x] 3.2 `HostTreeSidebar`: estados "bloqueada" y "bóveda no creada"
- [x] 3.3 Llamar a `ensureUnlocked` en host, Quick Connect, SFTP, RDP/VNC, importar `ssh_config`, guardar host/identidad; reintento ante `VAULT_LOCKED`
- [x] 3.4 `useSessionRestore`: locales sin bóveda, remotas tras desbloqueo, sin pisar el layout guardado + pruebas
- [x] 3.5 Panel de Configuración: opciones de auto-bloqueo y "pedir contraseña al iniciar" (es/en)

## 4. Validación
- [x] 4.1 `cd src-tauri && cargo test`
- [x] 4.2 `pnpm test`, `pnpm vue-tsc --noEmit`, `pnpm build`
- [ ] 4.3 Pruebas manuales (arranque sin prompt, host con modal, bloquear con sesiones abiertas, auto-bloqueo, primer uso)
- [ ] 4.4 `openspec validate` y sincronizar/archivar al terminar
