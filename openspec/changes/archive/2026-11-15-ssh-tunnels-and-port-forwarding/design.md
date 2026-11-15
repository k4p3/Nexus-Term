# Design: Gestor de Túneles SSH y Port Forwarding

## Context

NexusTerm dispone actualmente de un motor de conexiones SSH interactivo basado en `russh` y `tokio` para terminales PTY, además de gestión de inventario e identidades en una base de datos SQLite cifrada (`VaultManager`). Para complementar la gestión de infraestructura, se requiere implementar reenvío de puertos TCP (Local `-L`, Remoto `-R` y Dinámico SOCKS5 `-D`) que permita abrir canales seguros a través de SSH con control de estado y telemetría de red.

## Goals / Non-Goals

**Goals:**
- Persistir reglas de túneles en la tabla SQLite `ssh_tunnels` asociadas a servidores (`host_id`).
- Implementar **Local Port Forwarding (`-L`)** mediante `tokio::net::TcpListener` y canales `direct-tcpip` de `russh`.
- Implementar **Remote Port Forwarding (`-R`)** mediante `tcpip_forward` de `russh` reenviando hacia el destino local.
- Implementar **Dynamic SOCKS5 Proxy (`-D`)** según RFC 1928 sin autenticación, resolviendo dinámicamente peticiones `CONNECT` hacia canales `direct-tcpip`.
- Proporcionar control de ciclo de vida (start/stop) y telemetría en tiempo real (`bytes_sent`, `bytes_received`, `active_connections`, `status`).
- Ofrecer interfaz visual en Vue 3 con lista reactiva, modal de creación/edición y estado instantáneo.
- Cero dependencias externas adicionales, manteniendo estricta compatibilidad con la licencia GPLv3.

**Non-Goals:**
- Reenvío de datagramas UDP (el estándar SSH RFC 4254 especifica exclusivamente túneles de flujos TCP).
- Autenticación con usuario/contraseña para el proxy SOCKS5 local (el bind es exclusivamente en `127.0.0.1` en la máquina del usuario).
- Creación de interfaces de red virtuales TUN/TAP a nivel de kernel (VPN de capa 3).

## Decisions

### 1. Esquema SQLite para Persistencia de Túneles
Se añade la tabla `ssh_tunnels` en `src-tauri/src/vault/db.rs` vinculada con clave foránea a `hosts(id)`:
```sql
CREATE TABLE IF NOT EXISTS ssh_tunnels (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tunnel_type TEXT NOT NULL CHECK (tunnel_type IN ('local', 'remote', 'dynamic')),
    local_host TEXT NOT NULL DEFAULT '127.0.0.1',
    local_port INTEGER NOT NULL,
    remote_host TEXT,
    remote_port INTEGER,
    auto_start INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```
*Justificación*: Permite guardar configuraciones sin duplicar la información del host SSH y asegura eliminación en cascada si se borra el servidor.

### 2. Implementación Nativa de SOCKS5 (RFC 1928)
En lugar de agregar crates externos para SOCKS5, se implementa un parser asíncrono ligero en `src-tauri/src/tunnels/socks5.rs`:
- Negociación de métodos (versión `0x05`, método sin autenticación `0x00`).
- Comando de conexión (`0x01` para TCP CONNECT).
- Decodificación de direcciones destino: IPv4 (`0x01`), Nombre de Dominio / FQDN (`0x03`) e IPv6 (`0x04`).
- Respuesta de estado (`0x00` para éxito, `0x04` o `0x05` para host/red inalcanzable).
*Justificación*: Evita crates innecesarios, mantiene el control sobre el buffer de memoria y garantiza 100% compatibilidad con GPLv3.

### 3. Conexiones Autónomas e Hilos de Supervisión Asíncronos
Cada túnel iniciado por el usuario obtiene de forma autónoma una sesión SSH autenticada mediante las credenciales descifradas del host en `VaultManager`. Se crea una tarea `tokio::spawn` con un token de cancelación `tokio_util` / `tokio::sync::watch` para permitir la detención limpia del listener y el cierre de canales.
*Alternativa considerada*: Forzar que el usuario tenga una pestaña de terminal abierta para usar túneles. Se descartó porque los usuarios a menudo necesitan túneles en segundo plano sin una consola abierta.

### 4. Telemetría Atómica sin Bloqueos
Los contadores de bytes transferidos se registran utilizando `Arc<AtomicU64>` por cada túnel activo. Al consultar el estado mediante IPC, se leen los valores atómicos inmediatamente sin bloquear el flujo de datos TCP.

### 5. Contratos Tauri IPC
- `list_tunnels(host_id?: Option<String>) -> Result<Vec<TunnelConfig>, String>`
- `save_tunnel(payload: TunnelConfigPayload) -> Result<TunnelConfig, String>`
- `delete_tunnel(id: String) -> Result<(), String>`
- `start_tunnel(id: String) -> Result<(), String>`
- `stop_tunnel(id: String) -> Result<(), String>`
- `get_tunnel_statuses() -> Result<HashMap<String, TunnelRuntimeStatus>, String>`

## Risks / Trade-offs

- **[Riesgo] Puerto local ya ocupado**: Si el usuario especifica un puerto en uso (ej. 5432 ocupado por PostgreSQL local), `TcpListener::bind` fallará.
  - *Mitigación*: Capturar el error de bind y transicionar el estado del túnel a `error` con un mensaje descriptivo ("Puerto local 5432 ya está en uso por otro proceso").
- **[Riesgo] Desconexión de red con el host remoto**: Si la conexión SSH se cae, las conexiones locales enrutadas quedarían huérfanas.
  - *Mitigación*: Monitorear el heartbeat del canal SSH y cerrar los sockets asociados cuando el canal o la sesión se termine, actualizando el estado visual del túnel a `stopped`.
