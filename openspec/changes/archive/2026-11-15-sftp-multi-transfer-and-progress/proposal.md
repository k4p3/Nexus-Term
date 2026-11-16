# Proposal: Carga Múltiple de Archivos, Concurrencia Configurable y Progreso en SFTP

## Why
Actualmente el explorador SFTP de NexusTerm restringe la subida a un único archivo a la vez mediante un `<input type="file">` sin soporte de selección múltiple, carece de soporte para arrastrar y soltar (Drag & Drop) desde administradores de archivos del sistema operativo (Dolphin, Nautilus, etc.), no permite descargar múltiples archivos remotos en lote y utiliza una ruta fija local de descargas. Además, aunque el backend reporta progreso hacia una cola flotante (`TransferQueue.vue`), los usuarios no cuentan con indicadores de estado o avance inline dentro de la propia lista de archivos SFTP ni en la cabecera. Es necesario implementar transferencias masivas con una cola de trabajadores que respete un límite de concurrencia configurable (por defecto 2 transferencias simultáneas) para evitar saturar el canal SSH multiplexado, junto con feedback visual completo de cada archivo.

## What Changes
- **Subida múltiple de archivos**: Se habilita la selección de múltiples archivos mediante diálogo nativo (`rfd`) e `<input type="file" multiple>`, y se añade soporte completo para Drag & Drop (arrastrar y soltar desde el OS) sobre la lista de archivos SFTP.
- **Descarga múltiple de archivos**: Capacidad de seleccionar múltiples archivos remotos con casillas de verificación y descargarlos en bloque hacia la carpeta de descargas del usuario resuelta dinámicamente mediante `app_handle.path().download_dir()`.
- **Pool de concurrencia configurable**: La cola de transferencias procesará un máximo de transferencias activas simultáneas (valor por defecto: 2), encolando las restantes (`queued`) y activándolas de forma secuencial controlada a medida que se completen.
- **Ajuste de concurrencia en Configuración**: Se incorpora en `AppSettings` y en `SettingsModal.vue` un selector para que el usuario configure a su gusto el número de transferencias simultáneas (1 a 5).
- **Indicadores de estado y progreso inline**: Cada fila de archivo en el explorador SFTP mostrará su estado de transferencia en tiempo real (porcentaje, micro-barra de progreso, icono animado o badge de "Listo" / "Error") y la cabecera contará con un ticker resumen de avance.

## Capabilities

### Modified Capabilities
- `sftp-explorer`: Se modifican los requisitos de transferencia bidireccional y cola de transferencias para incorporar transferencias por lotes, Drag & Drop, concurrencia controlada y visibilidad inline de progreso por archivo.
- `app-settings`: Se modifica el esquema de configuración de la aplicación para persistir la preferencia de transferencias concurrentes máximas de SFTP (`sftp_max_concurrent_transfers`).

## Impact
- **Backend Rust (`src-tauri/`)**:
  - `src-tauri/Cargo.toml`: Adición del crate `rfd = "0.15"` para diálogos de archivos nativos del sistema.
  - `src-tauri/src/settings.rs`: Campo `sftp_max_concurrent_transfers: u32` (por defecto 2).
  - `src-tauri/src/sftp/commands.rs`: Comandos `sftp_pick_upload_files` y `sftp_get_download_directory`.
  - `src-tauri/src/sftp/client.rs`: Reporte robusto de errores con `TransferProgress` en `upload_file` y `download_file`.
- **Frontend Vue 3 (`src/`)**:
  - `src/types/settings.ts` y `src/stores/settings.store.ts`: Soporte de concurrencia en configuración.
  - `src/components/settings/SettingsModal.vue`: Selector de concurrencia en pestaña General.
  - `src/stores/sftp.store.ts`: Pool de trabajadores con concurrencia $N$, `uploadFiles`, `downloadFiles`, y getters reactivos de estado.
  - `src/components/sftp/SftpSidebar.vue`: Directivas y eventos de Drag & Drop, badges inline por archivo, ticker en toolbar y descarga múltiple de seleccionados.
  - `src/components/sftp/TransferQueue.vue`: Detalle de estados individuales, reintentos y velocidad.
- **Licencias**: `rfd` cuenta con licencias MIT / Apache-2.0, plenamente compatibles con GNU GPLv3.
