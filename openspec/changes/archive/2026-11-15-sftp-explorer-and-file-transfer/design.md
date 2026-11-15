# Design: Explorador SFTP Integrado y Transferencia de Archivos

## Context

NexusTerm dispone de autenticación SSH centralizada con `russh` y gestión de inventario en la bóveda SQLite. El protocolo SSH estandariza el subsistema SFTP (RFC draft-ietf-secsh-filexfer) para operaciones de archivos sobre canales seguros. Utilizando `russh-sftp` sobre una conexión autenticada de `russh`, se puede interactuar con el sistema de archivos remoto de forma transparente.

## Goals / Non-Goals

**Goals:**
- Conexión al subsistema SFTP utilizando `russh-sftp` montado sobre `channel.request_subsystem(false, "sftp")`.
- Navegación de directorios con soporte de rutas relativas y absolutas, resolución de `~` (home) y ordenamiento por tipo/nombre.
- Información detallada por elemento: nombre, tamaño, fecha de modificación, permisos UNIX (ej. `drwxr-xr-x`) y tipo de archivo.
- Operaciones básicas de gestión: crear directorio (`mkdir`), renombrar/mover (`rename`), y eliminar (`remove_file`, `remove_dir`).
- Transferencia asíncrona de archivos por bloques (64 KB) con emisión de progreso continuo mediante `tauri::ipc::Channel<TransferProgress>`.
- Componente Vue 3 `SftpSidebar.vue` con vista de árbol/tabla, barra de rutas (breadcrumbs), menú contextual y panel de transferencias activas.
- 100% compatible con GPLv3 (`russh-sftp` bajo Apache-2.0).

**Non-Goals:**
- Edición remota de archivos binarios o visor hexadecimal en línea.
- Compresión/descompresión remota (tar/zip), ya que excede las capacidades nativas del subsistema SFTP y requiere invocar binarios del shell.

## Decisions

### 1. Gestión de Sesiones SFTP (`SftpSessionManager`)
En `src-tauri/src/sftp/client.rs`:
```rust
pub struct SftpSession {
    pub client: russh_sftp::client::SftpClient<russh::ChannelStream<russh::client::Msg>>,
    pub host_id: String,
    pub current_path: String,
}
```
Se administra un mapa concurrente `Arc<Mutex<HashMap<String, SftpSession>>>` indexado por `session_id` (UUIDv7). Esto permite tener múltiples exploradores SFTP abiertos simultáneamente hacia distintos servidores sin interferencias.

### 2. Streaming de Transferencia sin Desbordamiento de Memoria
Tanto en subida como en bajada, los archivos se transmiten utilizando búferes de tamaño fijo (64 KB) entre el cliente SFTP remoto y `tokio::fs::File` local:
- Se consulta el tamaño total del archivo antes de iniciar.
- Se envía periódicamente una actualización de progreso con `bytes_transferred`, `total_bytes` y `percentage` a través de un canal binario/tipado IPC de Tauri (`tauri::ipc::Channel`).
- Se garantiza la liberación de descriptores de archivo en caso de cancelación o interrupción.

### 3. Modelos y Contratos IPC
- `SftpEntry`:
  ```rust
  pub struct SftpEntry {
      pub name: String,
      pub path: String,
      pub size: u64,
      pub is_dir: bool,
      pub is_symlink: bool,
      pub permissions: u32,
      pub modified_at: Option<String>,
  }
  ```
- Comandos Tauri IPC:
  - `sftp_connect(host_id: String) -> Result<String, String>`
  - `sftp_list_dir(session_id: String, path: Option<String>) -> Result<Vec<SftpEntry>, String>`
  - `sftp_mkdir(session_id: String, path: String) -> Result<(), String>`
  - `sftp_rename(session_id: String, old_path: String, new_path: String) -> Result<(), String>`
  - `sftp_remove(session_id: String, path: String, is_dir: bool) -> Result<(), String>`
  - `sftp_download(session_id: String, remote_path: String, local_path: String, on_progress: Channel<TransferProgress>) -> Result<(), String>`
  - `sftp_upload(session_id: String, local_path: String, remote_path: String, on_progress: Channel<TransferProgress>) -> Result<(), String>`
  - `sftp_disconnect(session_id: String) -> Result<(), String>`

## Risks / Trade-offs

- **[Riesgo] Conexión cerrada inesperadamente**: El servidor remoto puede cerrar la sesión por inactividad (`ClientAliveInterval`).
  - *Mitigación*: Capturar errores de socket en comandos SFTP y marcar la sesión como desconectada para permitir reconexión con un solo clic.
- **[Riesgo] Permisos insuficientes en rutas de sistema**: Intentar escribir en `/etc` o `/root` sin privilegios.
  - *Mitigación*: Retornar mensajes claros ("Permiso denegado por el servidor remoto") sin bloquear la interfaz.
