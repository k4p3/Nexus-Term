## 1. Esqueleto y datos

- [ ] 1.1 Crear `server/` (`nexus-sync-server`, `Cargo.lock` propio, dependencia por ruta de `sync-proto`), configuración por variables de entorno y arranque que exige `NEXUS_ADMIN_TOKEN` ≥ 32 caracteres.
- [ ] 1.2 Capa SQLite con migraciones por `user_version`: `users`, `devices`, `invites`, `key_bundles`, `records`, `user_seq`, `meta` (secreto del servidor).
- [ ] 1.3 Utilidades de seguridad: hash de tokens/invitaciones/verificador, comparación en tiempo constante, parámetros falsos estables para usuarios inexistentes, *rate limiter* en memoria.

## 2. API

- [ ] 2.1 `GET /healthz`, `GET /v1/kdf`, `POST /v1/register` (invitación) y `POST /v1/login` con errores uniformes.
- [ ] 2.2 Autenticación por token de dispositivo, `GET /v1/devices`, `DELETE /v1/devices/{id}` y `DELETE /v1/account`.
- [ ] 2.3 `GET/PUT /v1/keybundle` con versión optimista (y nuevo verificador opcional).
- [ ] 2.4 `GET /v1/changes` (paginado, `410` bajo el límite de purga) y `POST /v1/changes` (revisión +1, idempotencia, `409` con versión vigente, límites y cuotas).
- [ ] 2.5 Endpoints `/v1/admin/*` (invitaciones y usuarios) con token de administrador.
- [ ] 2.6 Límites de cuerpo y de lote, registros sin secretos (`tower-http` configurado) y tarea de purga de tombstones.

## 3. Operación y Docker

- [ ] 3.1 Subcomandos CLI: `serve`, `healthcheck`, `invite create|list|revoke`, `user list|delete`.
- [ ] 3.2 `Dockerfile` multi-etapa (distroless, no root, `HEALTHCHECK`), `.dockerignore`, `docker-compose.yml` endurecido con Caddy y `Caddyfile` de ejemplo.
- [ ] 3.3 Job de publicación multi-arquitectura en GHCR dentro de `.github/workflows/release.yml`.

## 4. Pruebas

- [ ] 4.1 Unitarias: hashing y comparación, parámetros falsos estables, *rate limiter*, validación de límites, purga.
- [ ] 4.2 Integración con dos dispositivos simulados: registro/login/revocación, subida y descarga idéntica, conflicto 409, reintento idempotente, aislamiento entre cuentas, invitación caducada/reutilizada/revocada, cuota, `410`, enumeración de usuarios, 429, tamaños, bundle con versión obsoleta y volcado sin texto legible.
- [ ] 4.3 Prueba de compatibilidad: el servidor y la app serializan el mismo `Envelope`.

## 5. Documentación

- [ ] 5.1 `docs/SYNC_SERVER.md` (despliegue paso a paso, variables, TLS con Caddy/Traefik/Nginx, copias de seguridad, actualización, arm64, licencias de imágenes), `docs/SYNC_THREAT_MODEL.md`, `ARCHITECTURE.md`, `README.md`, `README.es.md` y `CHANGELOG.md`.

## 6. Verificación

- [ ] 6.1 `cargo test` en `server/` y `crates/sync-proto`, `cd src-tauri && cargo test`, `pnpm test`, `vue-tsc --noEmit`, `vite build`; `docker build` y `docker compose up` con comprobación de salud, y licencias con `cargo metadata`.

## 7. Cierre

- [ ] 7.1 `openspec validate` y archivar el cambio.
