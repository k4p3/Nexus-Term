# Tasks: SSH Jump Hosts & Bastion Chaining

## 1. Backend Rust y Persistencia SQLite

- [ ] 1.1 Añadir migración en `src-tauri/src/vault/db.rs` para agregar la columna `jump_host_id TEXT REFERENCES hosts(id) ON DELETE SET NULL` en la tabla `hosts`.
- [ ] 1.2 Extender el struct `HostRecord` y `SaveHostPayload` en `src-tauri/src/vault/inventory.rs` con el campo `jump_host_id: Option<String>`.
- [ ] 1.3 Implementar la función de detección de referencias circulares `check_jump_host_cycles` en `src-tauri/src/vault/inventory.rs`.
- [ ] 1.4 Escribir pruebas unitarias en `src-tauri/src/vault/inventory.rs` verificando el guardado, recuperación y rechazo de ciclos en jump hosts.

## 2. Motor SSH y Ruteo Encadenado (direct-tcpip)

- [ ] 2.1 Implementar adaptador de stream asíncrono (`AsyncRead + AsyncWrite`) sobre canales `direct-tcpip` de `russh`.
- [ ] 2.2 Actualizar el flujo de conexión en `src-tauri/src/session.rs` para resolver la cadena de saltos y montar la conexión SSH sobre el túnel `direct-tcpip`.
- [ ] 2.3 Manejar errores explícitos de conexión y autenticación en servidores de salto intermedios.
- [ ] 2.4 Actualizar el parser de `~/.ssh/config` en `src-tauri/src/ssh_config/parser.rs` para mapear la directiva `ProxyJump`.

## 3. Frontend (Tipos, Stores y Componentes UI)

- [ ] 3.1 Actualizar las interfaces `Host` y `SaveHostPayload` en `src/types/inventory.ts` con `jump_host_id?: string | null`.
- [ ] 3.2 Añadir selector de "Servidor de Salto / Bastion (Opcional)" en `src/components/hosts/HostModal.vue`, filtrando el host actual.
- [ ] 3.3 Añadir indicador visual / badge de salto "via [Bastion]" en `src/components/hosts/HostTreeSidebar.vue` y `src/components/hosts/QuickConnectModal.vue`.
- [ ] 3.4 Actualizar pruebas unitarias de frontend en `src/stores/vault.test.ts`.

## 4. Verificación y Pruebas Integrales

- [ ] 4.1 Ejecutar suite completa de pruebas unitarias de Rust (`cargo test`).
- [ ] 4.2 Ejecutar suite completa de pruebas de frontend (`vitest run`).
- [ ] 4.3 Validar tipado estricto con `vue-tsc --noEmit`.
- [ ] 4.4 Compilar el paquete de producción (`tauri build`).
