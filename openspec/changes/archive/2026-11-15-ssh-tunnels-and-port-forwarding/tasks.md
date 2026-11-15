# Tasks: Gestor de Túneles SSH y Port Forwarding

## 1. Backend Rust: Esquema SQLite y Modelos

- [x] 1.1 Agregar migración de tabla `ssh_tunnels` y operaciones CRUD en `src-tauri/src/vault/db.rs`
- [x] 1.2 Crear estructuras y modelos en `src-tauri/src/tunnels/models.rs` (`TunnelConfig`, `TunnelType`, `TunnelConfigPayload`, `TunnelRuntimeStatus`)

## 2. Backend Rust: Motor de Port Forwarding y SOCKS5

- [x] 2.1 Implementar el módulo SOCKS5 en `src-tauri/src/tunnels/socks5.rs` con decodificación RFC 1928 y pruebas unitarias
- [x] 2.2 Implementar el gestor de túneles en `src-tauri/src/tunnels/manager.rs` gestionando listeners locales, reenvío remoto y SOCKS5 con telemetría atómica
- [x] 2.3 Implementar los comandos Tauri IPC en `src-tauri/src/tunnels/commands.rs` y registrarlos en `src-tauri/src/lib.rs`
- [x] 2.4 Escribir y validar pruebas unitarias en Rust con `cargo test` para el esquema de túneles y el protocolo SOCKS5

## 3. Frontend: Tipos, Servicios y Store

- [x] 3.1 Definir interfaces TypeScript en `src/types/tunnels.ts` y cliente IPC en `src/services/tunnels.service.ts`
- [x] 3.2 Implementar el store Pinia `src/stores/tunnels.store.ts` con actualización reactiva de estados y pruebas unitarias en `src/stores/tunnels.test.ts`

## 4. Frontend: Componentes e Interfaz de Usuario

- [x] 4.1 Crear el modal interactivo `src/components/tunnels/TunnelModal.vue` para creación y edición de reglas
- [x] 4.2 Crear el componente principal `src/components/tunnels/PortForwardManager.vue` con lista de túneles, controles start/stop y métricas en vivo
- [x] 4.3 Integrar el botón o pestaña de acceso al gestor de túneles en la interfaz principal de NexusTerm

## 5. Verificación Integral y Validación

- [x] 5.1 Ejecutar suite completa de tests de Rust (`cargo test`) y de frontend (`vitest run`)
- [x] 5.2 Validar chequeo de tipos estricto (`vue-tsc --noEmit`) y compilación (`vite build`)
- [x] 5.3 Validar formalmente la propuesta y especificaciones con `openspec validate --all --strict`
