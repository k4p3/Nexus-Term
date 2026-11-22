## Context

`vault/crypto.rs` ya ofrece Argon2id, AES-256-GCM y `VaultKey` (aleatoria por bóveda, envuelta con la clave de la contraseña maestra). `vault/db.rs` crea el esquema con `CREATE TABLE IF NOT EXISTS` y `ALTER TABLE` ad hoc. Los `delete_*` de `vault/inventory.rs` son definitivos y hostnames, usuarios y snippets están en claro. No hay código de sincronización.

## Goals / Non-Goals

**Goals:** primitivas criptográficas y de formato probadas con vectores; seguimiento de cambios robusto sin tocar los puntos de escritura; cero cambios visibles.
**Non-Goals:** red, servidor, UI, resolución de conflictos, historial/ajustes/layouts, rotación de la `VaultKey`.

## Decisions

1. **Sin workspace de Cargo en la raíz.** `crates/sync-proto` se añade como dependencia **por ruta** de `src-tauri` (y, más adelante, de `server/`, que tendrá su propio `Cargo.lock`). Así `src-tauri/Cargo.lock`, `tauri build`, `scripts/bump-version.mjs` y el empaquetado AUR/Flatpak/Snap siguen igual. Corrige el plan inicial, que proponía un workspace. Tarea de verificación: que los paquetes sigan compilando con la carpeta `crates/` presente.
2. **Jerarquía de claves.** `argon2_out = Argon2id(contraseña, sal_kdf, params)`; `AUK = HKDF-SHA256(ikm = argon2_out ‖ secret_key, salt = "nexusterm/sync/v1", info = "auk")`; `auth_key = HKDF(AUK, info = "auth")` y `wrap_key = HKDF(AUK, info = "wrap")`. La concatenación dentro de HKDF sustituye al XOR del plan (más estándar). Sal y parámetros viajan en el paquete de clave.
3. **Secret Key.** 16 bytes aleatorios; texto `NXT1-` + base32 (alfabeto RFC 4648 sin relleno) en grupos de 5 + 2 bytes de suma (`SHA-256(prefijo‖bytes)[..2]`). `parse()` normaliza mayúsculas/guiones y valida la suma.
3b. **Paquete con varias envolturas.** `bundle = { v, kdf: {alg, m, t, p, salt}, wrappings: [{ id: "pwd", ct }, { id: "recovery", ct }?] }`. Cada `ct` es la `VaultKey` envuelta con AES-256-GCM (AAD = `"nexusterm/bundle/v1|" + id`). Cambiar contraseña reescribe solo `pwd`.
3c. **Clave de recuperación.** 32 bytes aleatorios; texto `NXR1-` + base32 en grupos de 5 + 2 bytes de suma. `recovery_wrap_key = HKDF-SHA256(ikm = recovery_key, salt = "nexusterm/sync/v1", info = "recovery")`; sin Argon2id porque ya tiene 256 bits de entropía. No deriva la clave de autenticación: tras recuperar se fija una contraseña nueva y se reemite la `auth_key` a través de `sync-client-engine`. Se puede regenerar (rota la envoltura) o revocar (se elimina).
3d. **Kit de emergencia.** `emergency_kit(server_url, account, secret_key, recovery_key: Option<&str>, lang) -> String`: texto plano en es/en con campos y avisos (guardar en papel, no en el mismo equipo, quién puede ver el kit). Función pura y probada; la maquetación PDF/impresión corresponde a `sync-ui`. El tipo de entrada no admite la contraseña ni la `VaultKey`, de modo que no pueden incluirse por error.
4. **Sobre.** JSON: `{ "v": 1, "alg": "A256GCM", "kind", "id", "rev", "updated_at", "deleted", "n": b64, "ct": b64 }`. `AAD = "nexusterm/env/v1|kind|id|rev|deleted"`. Nonce aleatorio de 96 bits por cifrado. Tamaño máximo del texto claro 1 MiB. Un `deleted: true` cifra un texto vacío con el mismo AAD (tombstone autenticado: el servidor no puede convertir un registro vivo en borrado).
5. **Seguimiento con disparadores SQLite.** `sync_state(id=1, device_id, server_url, last_seq, applying)`. Por cada tabla seguida: `sync_rev INTEGER NOT NULL DEFAULT 0` y `sync_dirty INTEGER NOT NULL DEFAULT 1`. `AFTER INSERT/UPDATE` ponen `sync_dirty = 1` cuando `applying = 0` y la columna modificada no es la propia de sync (se evita el bucle con la condición `WHEN NEW.sync_dirty = OLD.sync_dirty`; la recursión de disparadores está desactivada por defecto). `AFTER DELETE` inserta en `sync_tombstones(kind, id, deleted_at)`. Los borrados en cascada también disparan los `AFTER DELETE` de las tablas hijas. Los snippets integrados se excluyen con `WHEN NEW.is_builtin = 0`.
6. **Por qué disparadores y no editar `inventory.rs`.** Cubren todas las rutas de escritura presentes y futuras (importación de `~/.ssh/config`, snippets, túneles) con un único punto, y las pruebas lo verifican a nivel SQL.
7. **Migración.** Idempotente, con comprobación de existencia de columnas (`PRAGMA table_info`) antes de cada `ALTER`. Los registros existentes quedan `sync_dirty = 1` para subirse en la primera sincronización.
8. **API de módulo (`src-tauri/src/sync/`).** `seal_record`, `open_record`, `pending_changes(conn) -> Vec<Pending>` y `mark_synced(conn, ...)`; sin comandos Tauri. Serialización del registro a JSON canónico por `kind`.

## Risks / Trade-offs

- **Disparadores y rendimiento:** coste despreciable con ~miles de registros; se mide en pruebas.
- **Cascadas:** el comportamiento de `ON DELETE CASCADE` con disparadores se cubre con pruebas explícitas (host con túneles, carpeta con hosts).
- **Metadatos visibles al servidor:** `kind`, `id`, `rev`, fechas y tamaños (inevitable); se documenta en el modelo de amenazas.
- **Pérdida de contraseña y Secret Key:** datos irrecuperables; lo recoge la documentación y se reforzará en la UI (`sync-ui`).
- **Cambiar KDF:** los parámetros van en el paquete, así que un cambio futuro solo requiere reenvolver.

## Migration Plan

Aditiva e idempotente. Sin vuelta atrás necesaria: las columnas y tablas nuevas no afectan al resto del código.

## Open Questions

- El PDF del kit usa el motor de impresión del webview (sin dependencias nuevas); se confirma en `sync-ui`.
- Si conviene firmar el paquete de clave (integridad adicional frente a un servidor malicioso que lo sustituya); se evalúa en `sync-hardening-docs`.
