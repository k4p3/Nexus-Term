# Tasks: Explorador SFTP Integrado y Transferencia de Archivos

## 1. Backend Rust y Subsistema SFTP

- [x] 1.1 Configurar dependencias y crear los modelos en `src-tauri/src/sftp/models.rs` (`SftpEntry`, `TransferProgress`, `TransferDirection`)
- [x] 1.2 Implementar el gestor de sesiones en `src-tauri/src/sftp/client.rs` para apertura del canal subsistema SFTP y navegación de directorios
- [x] 1.3 Implementar operaciones de transferencia streaming (download/upload en bloques de 64 KB con reporte de progreso) y manipulación de archivos (mkdir, rename, remove)
- [x] 1.4 Implementar comandos Tauri IPC en `src-tauri/src/sftp/commands.rs` y registrarlos en `src-tauri/src/lib.rs`
- [x] 1.5 Escribir pruebas unitarias en Rust para los modelos y utilidades de formato de permisos/rutas SFTP

## 2. Frontend: Tipos, Store y Servicios

- [x] 2.1 Definir interfaces TypeScript en `src/types/sftp.ts` y servicio IPC en `src/services/sftp.service.ts`
- [x] 2.2 Implementar el store Pinia `src/stores/sftp.store.ts` con gestión de sesiones, navegación, ruta actual, historial y cola de transferencias
- [x] 2.3 Escribir pruebas unitarias para `src/stores/sftp.store.ts` en `src/stores/sftp.test.ts`

## 3. Frontend: Componentes e Integración de UI

- [x] 3.1 Crear el componente `src/components/sftp/SftpSidebar.vue` con barra de breadcrumbs, listado de archivos/carpetas y barra de herramientas
- [x] 3.2 Crear el componente `src/components/sftp/TransferQueue.vue` para visualizar transferencias activas, velocidad y porcentaje
- [x] 3.3 Integrar acceso al explorador SFTP en la barra de herramientas principal y pestañas de terminal

## 4. Verificación y Validación

- [x] 4.1 Ejecutar conjunto de tests unitarios de Rust (`cargo test`) y de frontend (`vitest run`)
- [x] 4.2 Validar chequeo de tipos estricto (`vue-tsc --noEmit`) y compilación (`vite build`)
- [x] 4.3 Validar formalmente la propuesta y especificaciones con `openspec validate --all --strict`
