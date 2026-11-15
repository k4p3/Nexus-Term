# Tasks: Importador de ~/.ssh/config y known_hosts

## 1. Backend Rust y Parsers Nativos

- [x] 1.1 Crear el módulo `src-tauri/src/ssh_config/` y estructurar los structs `ParsedHostEntry`, `SshConfigPreview`, `ImportSshConfigPayload` e `ImportSummary`
- [x] 1.2 Implementar el parser de `~/.ssh/config` en `src-tauri/src/ssh_config/parser.rs` con soporte de directivas `Host`, `HostName`, `User`, `Port`, `IdentityFile`, `ProxyJump` y tests unitarios
- [x] 1.3 Implementar el parser de `known_hosts` en `src-tauri/src/ssh_config/known_hosts.rs` y la precarga en la tabla `known_hosts` de SQLite
- [x] 1.4 Implementar los comandos Tauri IPC `detect_ssh_config` e `import_ssh_config` en `src-tauri/src/ssh_config/commands.rs` y registrarlos en `lib.rs`
- [x] 1.5 Escribir pruebas unitarias exhaustivas en Rust para el parser de SSH config y la lógica de importación

## 2. Tipos de Datos y Servicios en el Frontend

- [x] 2.1 Definir las interfaces TypeScript en `src/types/ssh_config.ts` espejando los structs de Rust
- [x] 2.2 Implementar el cliente IPC `sshConfigService` en `src/services/ssh_config.service.ts`

## 3. Interfaz de Usuario y Componentes

- [x] 3.1 Crear el componente `src/components/hosts/SshConfigImportModal.vue` con previsualización de hosts, badges de duplicados, opciones de carpeta destino y casillas de selección
- [x] 3.2 Agregar botón de acceso rápido para importar desde `~/.ssh/config` en la cabecera de `HostTreeSidebar.vue`
- [x] 3.3 Integrar feedback de confirmación y refresco automático del inventario tras completar la importación

## 4. Verificación y Validación

- [x] 4.1 Ejecutar pruebas unitarias de Rust (`cargo test`) verificando el parsing y la lógica de importación
- [x] 4.2 Ejecutar pruebas de frontend y build (`vitest run`, `vue-tsc --noEmit`, `vite build`)
- [x] 4.3 Validar formalmente la propuesta y especificaciones con `openspec validate --all --strict`
