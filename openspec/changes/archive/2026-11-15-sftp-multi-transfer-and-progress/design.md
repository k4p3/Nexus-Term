# Design: Arquitectura de Transferencias Múltiples, Concurrencia y Progreso en SFTP

## Context
Ver `proposal.md` y `specs/`.
El cliente SFTP de NexusTerm corre sobre `russh-sftp` reutilizando la conexión SSH interactiva de Tokio. Actualmente `upload_file` y `download_file` reciben canales IPC (`Channel<TransferProgress>`) individuales. La interfaz web utiliza un input único para subir archivos y una ruta absoluta hardcodeada en descargas.

## Goals / Non-Goals

**Goals:**
- Subida de archivos por lotes mediante selector nativo (`rfd`), `<input multiple>` y Drag & Drop con eventos nativos de Tauri y web.
- Descarga masiva de archivos seleccionados resolviendo dinámicamente el directorio de descargas del sistema operativo (`~/Descargas` o `~/Downloads`).
- Pool de transferencias en el frontend (`sftp.store.ts`) con concurrencia limitada a $N$ (por defecto 2), respetando la configuración persistida en `app_settings`.
- Visualización en tiempo real del progreso de cada archivo tanto en `TransferQueue.vue` como inline en `SftpSidebar.vue`.

**Non-Goals:**
- No se implementa compresión tar/zip al vuelo en el servidor SSH remoto (requeriría shell interactivo separado fuera de la especificación SFTP pura).
- No se altera el tamaño de chunk de transferencia (se mantiene el bloque estándar y probado de 64 KB).

## Decisions

### 1. Diálogo de Archivos Nativo con `rfd` (Rusty File Dialog)
- **Decisión**: Utilizar `rfd = "0.15"` en Rust para `sftp_pick_upload_files`.
- **Por qué**: En navegadores y WebViews de Linux (WebKitGTK en Manjaro KDE Plasma / Wayland), el `<input type="file">` HTML convencional suele ocultar las rutas absolutas locales (`file.path` undefined) por seguridad web del motor. `rfd` interactúa de forma nativa y asíncrona con XDG Desktop Portal, devolviendo las rutas absolutas reales (`/home/usuario/archivo.txt`) de forma transparente y sin dependencias privativas (licencias MIT/Apache-2.0 compatibles con GPLv3).
- **Alternativa descartada**: Confiar exclusivamente en `<input type="file">`, lo que fallaba al extraer rutas completas en entornos Linux no Chromium.

### 2. Gestión de Concurrencia en Frontend con Worker Queue
- **Decisión**: Implementar un worker queue en `src/stores/sftp.store.ts` que despacha hasta `sftp_max_concurrent_transfers` promesas simultáneas de `sftpService.upload` / `sftpService.download`.
- **Por qué**: Mantener la orquestación de la cola en el store de Pinia permite reactividad inmediata en la UI (cambios de estado `queued` -> `in_progress` -> `completed` o `error`), cancelación individual, reintentos y actualización de badges inline en tiempo real.
- **Alternativa descartada**: Manejar la cola completamente en Rust. Aunque posible, añadiría complejidad de sincronización de estado de UI y dificultaría que el usuario cancele o pause elementos desde los componentes Vue.

### 3. Persistencia de Concurrencia en `AppSettings` (SQLite JSON)
- **Decisión**: Extender el struct `AppSettings` en `src-tauri/src/settings.rs` con:
  ```rust
  #[serde(default = "default_sftp_max_concurrent_transfers")]
  pub sftp_max_concurrent_transfers: u32,
  ```
  Con valor por defecto `2` y rango configurable en la UI de 1 a 5.
- **Por qué**: `app_settings` almacena las preferencias como JSON (`settings_json`). Al usar `#[serde(default)]`, no se requiere ninguna migración destructiva en SQLite; los registros preexistentes deserializan automáticamente con el valor `2`.

### 4. Resolución Dinámica de Descargas
- **Decisión**: Crear el comando Tauri `sftp_get_download_directory` usando `app_handle.path().download_dir()`.
- **Por qué**: Elimina por completo la ruta quemada en código `/home/jonathan/Descargas/` y se adapta al directorio oficial del usuario en cualquier idioma o sistema operativo (XDG user-dirs en Linux, `%USERPROFILE%\Downloads` en Windows, `~/Downloads` en macOS).

## IPC Contracts

```rust
// 1. Selector de archivos nativo
#[tauri::command]
pub async fn sftp_pick_upload_files() -> Result<Vec<String>, String>;

// 2. Directorio de descargas del sistema
#[tauri::command]
pub async fn sftp_get_download_directory(app_handle: AppHandle) -> Result<String, String>;
```

## Risks / Trade-offs

- **[Riesgo] Saturación del canal SSH multiplexado con muchas transferencias concurrentes**
  - *Mitigación*: Límite predeterminado fijado en 2 y restringido a un máximo sensato de 5 en la configuración.
- **[Riesgo] Archivos arrastrados que no existen o son carpetas locales**
  - *Mitigación*: En el frontend y en el comando de subida, se verifica si el path es un archivo regular antes de iniciar la transmisión.
