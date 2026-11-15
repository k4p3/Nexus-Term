# Design

## Context

El proyecto parte desde un repositorio limpio en Linux (Manjaro KDE Plasma) con el objetivo de construir una aplicación de escritorio multiplataforma para gestión de conexiones SSH. Ver `proposal.md` para la motivación del proyecto.

## Goals / Non-Goals

**Goals:**
- Garantizar latencia mínima de teclado a pantalla en la terminal (streaming binario directo sin serialización JSON por carácter).
- Proteger todas las credenciales en reposo con criptografía moderna (`Argon2id` + `AES-256-GCM`) y permitir rotación instantánea de contraseña maestra mediante envoltura de clave (`Key Wrapping`).
- Preparar el gestor de sesiones SSH sobre `russh` para soportar multiplexación futura (SFTP, túneles y telemetría sobre la misma conexión TCP).

**Non-Goals:**
- No se implementará el subsistema visual SFTP ni el gestor de túneles de puertos en la Fase 1 (se dejan preparados los puntos de extensión en el `SessionManager` de Rust).
- No se implementará aún la sincronización externa (Git/WebDAV), aunque el esquema de base de datos ya incluye `UUIDv7` y `updated_at` por registro para permitir sincronización sin conflictos en la Fase 5.

## Decisions

### 1. Envoltura de Clave (`VaultKey`) con Argon2id + AES-256-GCM
- **Decisión**: Al inicializar la bóveda, se genera una `VaultKey` aleatoria de 256 bits (`OsRng`). La contraseña maestra del usuario pasa por `Argon2id` (`m=64 MiB, t=3, p=4`) para derivar una `MasterKey` que cifra únicamente la `VaultKey` en la tabla `vault_meta`. Cada secreto en las tablas `identities` y `hosts` se cifra con la `VaultKey` usando `AES-256-GCM` y un nonce aleatorio de 96 bits (`[nonce (12B) || ciphertext || tag (16B)]`).
- **Racional**: Permite cambiar la contraseña maestra en milisegundos (solo se recifra `vault_meta`) y permite sincronizar registros individuales entre dispositivos sin corromper un archivo binario único.
- **Alternativa descartada**: SQLCipher sobre todo el archivo SQLite (descartado porque impide hacer *merge* registro por registro al sincronizar por Git/Syncthing y añade dependencias en C más pesadas de compilar en multiplataforma).

### 2. Streaming Binario con `tauri::ipc::Channel` hacia `xterm.js`
- **Decisión**: Para el flujo de salida (`STDOUT`/`STDERR`) desde `russh` o `portable-pty` hacia Vue, el comando `open_ssh_session` / `open_local_pty` recibe un `tauri::ipc::Channel<Vec<u8>>`. En el frontend, los chunks llegan como `Uint8Array` y se pasan directamente a `terminal.write(chunk)` con `@xterm/addon-webgl` activado.
- **Racional**: Los eventos globales de Tauri (`app.emit`) serializan payloads en JSON, lo que degrada el rendimiento al ejecutar comandos de alto volumen como `htop`, `dmesg` o `cat` de archivos grandes.

### 3. Esquema SQLite (`vault.db`)
```sql
CREATE TABLE vault_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    kdf_salt BLOB NOT NULL,
    kdf_mem_kib INTEGER NOT NULL,
    kdf_iterations INTEGER NOT NULL,
    kdf_parallelism INTEGER NOT NULL,
    wrapped_vault_key BLOB NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

CREATE TABLE identities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    auth_type TEXT NOT NULL CHECK (auth_type IN ('password', 'private_key', 'agent')),
    encrypted_secret BLOB,
    encrypted_passphrase BLOB,
    updated_at TEXT NOT NULL
);

CREATE TABLE hosts (
    id TEXT PRIMARY KEY,
    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    label TEXT NOT NULL,
    hostname TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username_override TEXT,
    identity_id TEXT REFERENCES identities(id) ON DELETE SET NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    encrypted_notes BLOB,
    updated_at TEXT NOT NULL
);

CREATE TABLE known_hosts (
    id TEXT PRIMARY KEY,
    hostname TEXT NOT NULL,
    port INTEGER NOT NULL,
    key_type TEXT NOT NULL,
    fingerprint_sha256 TEXT NOT NULL,
    public_key_base64 TEXT NOT NULL,
    trusted_at TEXT NOT NULL,
    UNIQUE(hostname, port)
);
```

### 4. Contratos Tauri IPC (Comandos Principales Fase 1)
- **Vault**: `vault_status()`, `vault_init(master_password)`, `vault_unlock(master_password)`, `vault_lock()`, `vault_change_password(current_password, new_password)`.
- **Inventory**: `list_inventory()`, `save_folder(payload)`, `delete_folder(id)`, `save_identity(payload)`, `delete_identity(id)`, `save_host(payload)`, `delete_host(id)`.
- **Sessions**:
  - `connect_ssh(host_id, cols, rows, on_data: Channel<TerminalEvent>) -> SessionId`
  - `open_local_pty(cols, rows, on_data: Channel<TerminalEvent>) -> SessionId`
  - `write_session(session_id, data: Vec<u8>)`
  - `resize_session(session_id, cols, rows)`
  - `close_session(session_id)`
  - `trust_host_fingerprint(hostname, port, key_type, fingerprint, public_key)`

## Risks / Trade-offs

- **[Riesgo] Bloqueo de handshake SSH ante servidor nuevo (TOFU)** → **Mitigación**: En el handler `check_server_key` de `russh::client::Handler`, usar un canal `tokio::sync::oneshot` que emite el evento `HostKeyVerificationRequired` al frontend y espera la decisión del usuario (con timeout de 60 segundos) antes de aceptar o rechazar la conexión.
- **[Riesgo] Fuga de memoria en pestañas cerradas** → **Mitigación**: Asegurar en `onBeforeUnmount` del componente `TerminalPane.vue` tanto `terminal.dispose()` como la invocación a `close_session(session_id)` para abortar las tareas de `tokio` asociadas.
