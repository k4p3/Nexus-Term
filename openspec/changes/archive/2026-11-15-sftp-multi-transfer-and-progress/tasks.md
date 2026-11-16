# Tasks: Implementación de Transferencias Múltiples, Concurrencia y Progreso en SFTP

## 1. Backend Rust: Dependencias, Comandos IPC y Preferencias

- [x] 1.1 Agregar dependencia `rfd = "0.15"` a `src-tauri/Cargo.toml` y verificar compilación de crates con `cargo check --manifest-path src-tauri/Cargo.toml`
- [x] 1.2 Extender `AppSettings` en `src-tauri/src/settings.rs` con el campo `sftp_max_concurrent_transfers: u32` (por defecto 2) y añadir prueba unitaria verificando serialización/deserialización
- [x] 1.3 Implementar comandos `sftp_pick_upload_files` (usando `rfd::AsyncFileDialog`) y `sftp_get_download_directory` (usando `app_handle.path().download_dir()`) en `src-tauri/src/sftp/commands.rs`, registrándolos en `src-tauri/src/lib.rs`
- [x] 1.4 Reforzar emisión de eventos `TransferProgress` con `status: "error"` en `src-tauri/src/sftp/client.rs` ante fallos de I/O y verificar con `cargo test --manifest-path src-tauri/Cargo.toml`

## 2. Frontend: Tipos, Servicios y Configuración de Concurrencia

- [x] 2.1 Actualizar interfaces en `src/types/settings.ts` y valores por defecto en `src/stores/settings.store.ts` con `sftp_max_concurrent_transfers`
- [x] 2.2 Agregar llamadas a comandos `pickUploadFiles` y `getDownloadDirectory` en `src/services/sftp.service.ts`
- [x] 2.3 Agregar sección de configuración de concurrencia SFTP en `src/components/settings/SettingsModal.vue` y claves de traducción en `src/locales/es.json` y `src/locales/en.json`

## 3. Store SFTP: Worker Queue con Concurrencia N y Operaciones en Lote

- [x] 3.1 Extender tipos y estados de transferencias en `src/types/sftp.ts` (`queued`, `in_progress`, `completed`, `error`, `cancelled`)
- [x] 3.2 Implementar cola de transferencias con worker pool concurrente (`processQueue`), `uploadFiles` y `downloadFiles` en `src/stores/sftp.store.ts`
- [x] 3.3 Agregar getters computados `activeTransfersMap` y `overallProgress` en `src/stores/sftp.store.ts`
- [x] 3.4 Escribir pruebas unitarias en `src/stores/sftp.test.ts` verificando el límite de concurrencia y el procesamiento de lotes, ejecutando `pnpm test`

## 4. Componentes UI: Drag & Drop, Badges Inline y Selección Múltiple

- [x] 4.1 Implementar directivas y zona visual de Drag & Drop en `src/components/sftp/SftpSidebar.vue` integrando eventos web y `getCurrentWebview().onDragDropEvent`
- [x] 4.2 Reemplazar selector simple por botón con diálogo nativo `pickUploadFiles()` y respaldo `<input type="file" multiple>` en `src/components/sftp/SftpSidebar.vue`
- [x] 4.3 Añadir barra de acciones para elementos seleccionados (descarga en lote y eliminación) en `src/components/sftp/SftpSidebar.vue`
- [x] 4.4 Implementar badges e indicadores de progreso inline en cada fila de archivo y ticker de resumen en la barra de herramientas de `src/components/sftp/SftpSidebar.vue`
- [x] 4.5 Actualizar `src/components/sftp/TransferQueue.vue` con estados `queued`, velocidad estimada y botón de reintento para fallos

## 5. Verificación Integral y Pruebas Automatizadas

- [x] 5.1 Ejecutar suite completa de tests de frontend `pnpm test` y verificar 100% aprobados
- [x] 5.2 Ejecutar comprobación estricta de tipos `pnpm exec vue-tsc --noEmit` y compilación de producción `pnpm build`
- [x] 5.3 Ejecutar suite completa de tests de backend `cargo test --manifest-path src-tauri/Cargo.toml`
- [x] 5.4 Validar especificaciones con `openspec validate`
