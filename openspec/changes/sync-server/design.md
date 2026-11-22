## Context

`crates/sync-proto` ya define `Envelope`, `KeyBundle`, `KdfParams` y las claves. El servidor no necesita descifrar nada: es un almacén ordenado de sobres con control de revisiones, cuentas y dispositivos. La app aún no tiene cliente HTTP (llega en `sync-client-engine`).

## Goals / Non-Goals

**Goals:** servidor pequeño, auditable y fácil de desplegar en un homelab; cero conocimiento del contenido; defensas básicas contra abuso; imagen mínima y multi-arquitectura.
**Non-Goals:** TLS propio (lo da el proxy), SSO/OIDC, sincronización en tiempo real (WebSocket), compartir datos entre usuarios, alta disponibilidad/clúster, métricas Prometheus (puede venir después).

## Decisions

1. **Crate independiente `server/`** con su `Cargo.lock`, dependiente por ruta de `crates/sync-proto`. No hay workspace en la raíz (decisión de `sync-foundations`), así que no se altera el build de Tauri. Una prueba verifica que el servidor y la app serializan el mismo `Envelope`.
2. **Autenticación.** `auth_key` (32 bytes, derivada en el cliente) se envía por TLS y el servidor guarda `SHA-256(sal_usuario ‖ auth_key)`; basta un hash rápido porque la clave ya tiene 256 bits de entropía y el coste de adivinar contraseña + Secret Key lo paga el KDF del cliente (Argon2id). Comparación con `subtle::ConstantTimeEq`. *Corrige el plan inicial, que hablaba de Argon2 en el servidor.* El token de dispositivo (32 bytes aleatorios, base64url) se devuelve una sola vez y se guarda como `SHA-256`.
3. **Sin enumeración de usuarios.** `GET /v1/kdf?username=` devuelve los parámetros reales o, para un usuario inexistente, unos falsos y **estables** derivados con `HMAC-SHA256(secreto_del_servidor, username)` (el secreto se genera una vez y vive en la tabla `meta`). Los errores de login son idénticos para «usuario inexistente» y «clave incorrecta», y el tiempo de respuesta no depende de la existencia (se hace siempre una comparación).
4. **Modelo de datos (SQLite, `PRAGMA user_version` para migraciones, WAL).**
   - `users(id, username UNIQUE, auth_salt, auth_hash, kdf_json, purge_floor, created_at)`
   - `devices(id, user_id, name, token_hash UNIQUE, created_at, last_seen_at, last_seq, revoked)`
   - `invites(code_hash PK, created_at, expires_at, used_by, note, revoked)`
   - `key_bundles(user_id PK, version, bundle_json, updated_at)`
   - `records(user_id, kind, id, rev, seq, deleted, updated_at, envelope_json, PRIMARY KEY(user_id, kind, id))` con índice `(user_id, seq)`
   - `user_seq(user_id PK, seq)` y `meta(key, value)`
   Una sola conexión protegida con `Mutex` y operaciones en `spawn_blocking`; para un homelab es suficiente y evita bloqueos de escritura.
5. **Conflictos y reintentos.** En `POST /v1/changes` cada cambio se procesa en su propia transacción: acepta si `rev == actual + 1` (o `1` si no existe); si es idéntico al almacenado (mismo `rev` y mismo `ct`) responde éxito idempotente; en otro caso `409` con el sobre vigente en ese elemento. La resolución *última modificación gana* y la copia de conflicto la hace el cliente (el servidor no puede leer el contenido).
6. **Feed de cambios.** `GET /v1/changes?since=N&limit=M` (máx. 500) ordena por `seq`; devuelve `more` y `next_seq`. Si `since < purge_floor` responde `410`.
7. **Retención.** Tarea periódica (al arrancar y cada 24 h) borra tombstones con `updated_at` anterior a `NEXUS_TOMBSTONE_DAYS` y sube `purge_floor` al mayor `seq` purgado. Valor por defecto 90 días.
8. **Límites por defecto (configurables por entorno).** Cuerpo 2 MiB; sobre ≤ 1 MiB + sobrecarga; 200 cambios por petición; 50 000 registros por usuario; 50 usuarios; invitaciones con caducidad por defecto de 48 h. *Rate limit* de login en memoria (ventana deslizante de 15 min, 5 fallos por `IP + usuario`); se documenta que se reinicia al reiniciar el contenedor. `X-Forwarded-For` solo se usa con `NEXUS_TRUST_PROXY=1`.
9. **Administración.** `NEXUS_ADMIN_TOKEN` (≥ 32 caracteres, obligatorio al arrancar) protege `/v1/admin/*`. Además, subcomandos CLI que operan directamente sobre la base (misma máquina, mismo volumen): `invite create [--ttl 48h] [--note ..]`, `invite list|revoke`, `user list|delete`, `healthcheck`. Las invitaciones son 160 bits aleatorios en base32; solo se guarda su hash.
10. **Registros.** `tracing` con `tower-http::trace` configurado para no capturar cuerpos ni cabeceras `Authorization`/`X-Admin-Token`; fallos de autenticación a nivel `warn` con IP y usuario, sin secretos.
11. **Docker.** `Dockerfile` multi-etapa: `rust:1.90-slim` (compila con SQLite embebido) → `gcr.io/distroless/cc-debian12:nonroot`, sin shell, usuario 65532, `VOLUME /data`, `EXPOSE 8787`, `HEALTHCHECK CMD ["/nexus-sync-server","healthcheck"]` (consulta `/healthz` local). `docker-compose.yml` de ejemplo con `read_only: true`, `tmpfs` para `/tmp`, `cap_drop: [ALL]`, `security_opt: no-new-privileges` y un servicio **Caddy** que termina TLS. Publicación en GHCR con `docker/build-push-action` (`linux/amd64,linux/arm64`, etiquetas `vX.Y.Z` y `latest`), añadida a `release.yml` sin afectar a los jobs existentes.
12. **Pruebas de integración** (`server/tests/`): servidor en proceso en un puerto aleatorio y una base temporal; dos «dispositivos» con `sync-proto` (registro, login en el segundo, subida/descarga, conflicto, reintento idempotente, revocación, rate limit, caducidad/reutilización de invitación, cuota, purga y `410`, enumeración, límites de tamaño, aislamiento entre cuentas, volcado sin texto legible).

## Risks / Trade-offs

- **Servidor malicioso o comprometido:** puede retener/descartar cambios o devolver estados antiguos (*rollback*); la detección se estudia en `sync-hardening-docs`. No puede leer ni alterar el contenido (AAD).
- **Una sola conexión SQLite:** limita la concurrencia de escritura; aceptable para un homelab (decenas de usuarios).
- **Rate limit en memoria:** se pierde al reiniciar; aceptado y documentado.
- **Sin TLS integrado:** exponerlo en HTTP en internet filtraría tokens; la documentación y el compose lo imponen con Caddy, y la app exigirá HTTPS salvo LAN/localhost confirmada (en `sync-client-engine`).
- **Copias de seguridad:** el operador debe respaldar el volumen `/data`; se documenta cómo (`sqlite3 .backup` o copia en frío).
- **Imágenes base:** las licencias de los paquetes de distroless/Debian se documentan en `docs/SYNC_SERVER.md`.

## Migration Plan

Aditivo: no toca la app ni sus datos. El esquema del servidor se versiona con `user_version` para actualizaciones futuras.

## Open Questions

Resueltas con la aprobación de la propuesta:
- **Valores por defecto aprobados:** retención de tombstones 90 días, límite de login 5 fallos / 15 min por IP + usuario, cuerpo 2 MiB, 200 cambios por petición, 50 000 registros por usuario, 50 usuarios, invitaciones de 48 h.
- **`DELETE /v1/account`:** solo con la `auth_key` del propio usuario (sin confirmación del administrador).

## Estado

Propuesta **aprobada**; implementación pendiente (se retoma en la siguiente sesión, empezando por la tarea 1.1).
