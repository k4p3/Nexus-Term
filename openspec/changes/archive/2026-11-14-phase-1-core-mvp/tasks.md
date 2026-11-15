# Tasks

## 1. Inicialización del Workspace de NexusTerm (`nexus-term`)

- [x] 1.1 Inicializar el proyecto frontend `nexus-term` (Vite + Vue 3 + TypeScript + Pinia + Tailwind CSS + `@xterm/xterm` + addons) y verificar que `pnpm run build` o `npm run build` compile sin errores.
- [x] 1.2 Inicializar el crate `src-tauri` (`nexus-term`, identificador `dev.nexusterm.app`) con Tauri v2 y las dependencias core (`tokio`, `rusqlite`, `argon2`, `aes-gcm`, `zeroize`, `russh`, `russh-keys`, `portable-pty`, `uuid`, `serde`, `thiserror`) y verificar que `cargo check` en `src-tauri/` termine con éxito.

## 2. Motor de Bóveda Cifrada y Esquema SQLite (`vault-security`)

- [x] 2.1 Implementar el módulo `src-tauri/src/vault/crypto.rs` con derivación `Argon2id`, envoltura de `VaultKey` con `AES-256-GCM` y limpieza con `Zeroize`, verificando con tests unitarios (`cargo test vault::crypto`) la inicialización, desbloqueo, fallo con clave errónea y rotación de contraseña maestra.
- [x] 2.2 Implementar el módulo `src-tauri/src/vault/db.rs` con migraciones SQLite (`vault_meta`, `folders`, `identities`, `hosts`, `known_hosts`) y comandos Tauri (`vault_status`, `vault_init`, `vault_unlock`, `vault_lock`, `vault_change_password`), verificando con tests de integración sobre SQLite en memoria.
- [x] 2.3 Crear el store `src/stores/vault.store.ts` y la vista `src/components/vault/VaultUnlockScreen.vue` (modos Inicializar y Desbloquear) verificando el flujo de bloqueo/desbloqueo desde la UI.

## 3. Inventario de Carpetas, Identidades y Hosts (`host-inventory`)

- [x] 3.1 Implementar en Rust (`src-tauri/src/vault/inventory.rs`) los comandos CRUD para carpetas, identidades (cifrando `encrypted_secret` y `encrypted_passphrase` con la `VaultKey` activa) y hosts, verificando con tests unitarios que ningún secreto quede en texto plano en SQLite.
- [x] 3.2 Crear los componentes de UI `HostTreeSidebar.vue`, `HostModal.vue` e `IdentityModal.vue` conectados a `vault.store.ts` y verificar la creación, edición y borrado de carpetas, identidades y servidores.
- [x] 3.3 Implementar la paleta de búsqueda rápida `QuickConnectModal.vue` (`Ctrl+K`) que filtra por alias, hostname, carpeta o etiqueta y verificar que al pulsar `Enter` dispare la apertura de sesión.

## 4. Motor de Terminal Local y SSH con Multiplexación (`terminal-multiplexer`)

- [x] 4.1 Implementar el gestor de PTY local (`src-tauri/src/pty/mod.rs`) con `portable-pty` y streaming binario por `tauri::ipc::Channel`, verificando que los comandos `open_local_pty`, `write_session`, `resize_session` y `close_session` compilen y ejecuten el shell del sistema.
- [x] 4.2 Implementar el cliente SSH asíncrono (`src-tauri/src/ssh/mod.rs`) con `russh`, incluyendo autenticación por contraseña/llave privada/agente y verificación interactiva de huella TOFU contra la tabla `known_hosts`, verificando su compilación con `cargo check`.
- [x] 4.3 Construir los componentes `TerminalWorkspace.vue`, `SplitPaneNode.vue`, `TerminalPane.vue` (con `@xterm/xterm`, `@xterm/addon-webgl` y `@xterm/addon-fit`) y `HostKeyPromptModal.vue`, verificando la apertura de pestañas, división horizontal/vertical de paneles y redimensionado dinámico.

## Workflow follow-up

- Validar las especificaciones con `openspec validate --strict`.
- Archivar el cambio con `openspec archive phase-1-core-mvp` una vez completada y verificada la Fase 1.
