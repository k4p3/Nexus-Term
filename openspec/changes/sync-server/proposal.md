## Why

`sync-foundations` dejó listo el formato cifrado, las claves y el seguimiento local de cambios, pero no hay dónde enviarlos. Quien tenga un homelab quiere desplegar **un servidor propio en Docker** que guarde las bóvedas de sus usuarios sin poder leerlas, y usar el mismo inventario desde varios equipos. Este cambio construye ese servidor y su imagen; el cliente que lo usa llega en `sync-client-engine`.

Es el segundo de cinco cambios (`sync-foundations` ✔ → **`sync-server`** → `sync-client-engine` → `sync-ui` → `sync-hardening-docs`).

## What Changes

- **Nuevo binario `server/` (`nexus-sync-server`)**: axum + SQLite (`rusqlite`), con su propio `Cargo.lock` y dependencia por ruta de `crates/sync-proto` (los mismos tipos y sobres que la app). Sin tocar `src-tauri`.
- **API REST/JSON `v1`** (HTTP; el TLS lo pone un proxy inverso):
  - Salud: `GET /healthz`.
  - Cuentas: `POST /v1/register` (solo con invitación), `GET /v1/kdf?username=` (parámetros públicos del KDF, indistinguibles para usuarios inexistentes), `POST /v1/login` (clave de autenticación → token de dispositivo).
  - Dispositivos: `GET /v1/devices`, `DELETE /v1/devices/{id}` (revocación inmediata).
  - Paquete de clave: `GET/PUT /v1/keybundle` con control de versión optimista (cambiar contraseña o clave de recuperación).
  - Sincronización: `GET /v1/changes?since=<seq>` y `POST /v1/changes` por registro, con detección de conflicto (`409` + versión vigente) y reintentos idempotentes. `DELETE /v1/account`.
  - Administración (token de admin): crear/listar/revocar invitaciones, listar/borrar usuarios.
- **Zero-knowledge**: el servidor guarda `Envelope` opacos tal como llegan; nunca recibe contraseña, Secret Key, clave de la bóveda ni la clave de recuperación. Solo almacena el verificador de la clave de autenticación y el paquete de clave (ya envuelto).
- **Retención de borrados** (papelera): los *tombstones* se purgan pasados N días (90 por defecto); un dispositivo que lleve más tiempo sin sincronizar recibe `410 Gone` y debe resincronizar entero (evita resucitar registros).
- **Protección ante abuso**: límite de intentos de login (5 fallos / 15 min por IP+usuario, `429` + `Retry-After`), tamaños máximos, cuotas por usuario, tokens de dispositivo de 256 bits guardados solo como hash, comparaciones en tiempo constante, registros sin cuerpos ni tokens.
- **CLI de operación** (para `docker exec`): `invite create|list|revoke`, `user list|delete`, `healthcheck`.
- **Docker**: `Dockerfile` multi-etapa (imagen mínima sin shell, usuario no root, volumen `/data`, `HEALTHCHECK`), `docker-compose.yml` de ejemplo con Caddy y TLS, publicación multi-arquitectura (amd64 y arm64) en GHCR desde `release.yml`, y guía de despliegue y copias de seguridad.
- **Pruebas de integración** con dos dispositivos simulados (usando `sync-proto`), incluida la comprobación de que el volcado de la base no contiene texto legible.

## Capabilities

### New Capabilities
- `sync-server`: servidor de sincronización autoalojado, zero-knowledge, con cuentas por invitación, dispositivos revocables, sincronización por registro con detección de conflictos y despliegue en Docker.

### Modified Capabilities
- (ninguna)

## Impact

- Nuevos: `server/` (código, migraciones, pruebas de integración, `Dockerfile`, `docker-compose.yml`, `Caddyfile` de ejemplo, `.dockerignore`), `docs/SYNC_SERVER.md` (despliegue, variables, copias de seguridad, actualización).
- Modificados: `.github/workflows/release.yml` (job de imagen Docker), `.gitignore`, `docs/SYNC_THREAT_MODEL.md`, `ARCHITECTURE.md`, `README.md`/`README.es.md` (sección del servidor) y `CHANGELOG.md`.
- Sin cambios en `src-tauri` ni en el frontend.

## Licencias (nuevas dependencias del servidor)

| Paquete | Licencia | Compatible con GPLv3 |
|---|---|---|
| `axum` | MIT | Sí |
| `tower`, `tower-http` | MIT | Sí |
| `tokio`, `tracing`, `tracing-subscriber` | MIT | Sí |
| `subtle` | BSD-3-Clause | Sí |
| `rusqlite` (bundled SQLite), `serde`, `serde_json`, `rand`, `sha2`, `uuid`, `chrono`, `base64`, `thiserror` | MIT / Apache-2.0 / dominio público (SQLite) | Sí |
| Imágenes base (`rust` para compilar, `gcr.io/distroless/cc`) | Apache-2.0 / licencias de sus paquetes Debian | Se documentan en `docs/SYNC_SERVER.md` |

Se comprueba con `cargo metadata` antes de archivar. Sin dependencias privativas.
