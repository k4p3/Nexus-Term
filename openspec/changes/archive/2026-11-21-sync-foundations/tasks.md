## 1. Crate `sync-proto`

- [x] 1.1 Crear `crates/sync-proto` (sin red) y añadirlo como dependencia por ruta en `src-tauri/Cargo.toml`; añadir `hkdf` y `data-encoding`.
- [x] 1.2 `envelope.rs`: sellado/apertura con AAD, versión y algoritmo, tope de tamaño, tombstones sin contenido.
- [x] 1.3 `keys.rs`: Secret Key (generar, formatear, `parse` con suma de comprobación), AUK, `auth_key` y `wrap_key` con zeroización.
- [x] 1.4 `bundle.rs`: paquete de clave con lista de envolturas (`pwd`, `recovery`) y parámetros del KDF (envolver/desenvolver, reenvolver al cambiar la contraseña).
- [x] 1.4b `recovery.rs`: clave de recuperación (generar, formatear, `parse` con suma), envoltura `recovery`, rotación y revocación; `kit.rs`: `emergency_kit` es/en.
- [x] 1.5 Pruebas: ida y vuelta, manipulación de cada campo, versión/algoritmo desconocidos, ausencia de texto en claro, vectores fijos de HKDF, claves independientes, contraseña o Secret Key erróneas, formato y suma de la Secret Key; recuperación tras perder la contraseña (nueva contraseña sin recifrar registros), independencia de la clave de recuperación, rechazo por suma errónea, revocación; kit con Secret Key y sin contraseña ni `VaultKey`, con y sin clave de recuperación.

## 2. Bóveda local

- [x] 2.1 Migración idempotente en `vault/db.rs`: `sync_state`, `sync_tombstones`, columnas `sync_rev`/`sync_dirty` y disparadores para `folders`, `identities`, `hosts`, `ssh_tunnels` y `snippets` no integrados.
- [x] 2.2 `src-tauri/src/sync/mod.rs`: `seal_record`/`open_record` por `kind`, `pending_changes` y `mark_synced`.
- [x] 2.3 Pruebas Rust: marcado en insert/update, tombstone en delete y en cascada, snippets integrados ignorados, `applying = 1` no marca ni crea tombstones, migración idempotente sobre bóveda antigua, registros existentes pendientes.

## 3. Documentación

- [x] 3.1 `ARCHITECTURE.md` (módulo `sync` y `sync-proto`) y `docs/SYNC_THREAT_MODEL.md` inicial (con la recuperación y su custodia) (qué ve un servidor comprometido, qué se pierde sin Secret Key).

## 4. Verificación

- [x] 4.1 `cd src-tauri && cargo test`, `cargo test` en `crates/sync-proto`, `pnpm test`, `vue-tsc --noEmit`, `vite build`; comprobar que el empaquetado sigue compilando con `crates/` presente y licencias con `cargo license`.

## 5. Cierre

- [x] 5.1 `openspec validate` y archivar el cambio.
