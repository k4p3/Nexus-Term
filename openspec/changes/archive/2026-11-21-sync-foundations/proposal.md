## Why

Se quiere sincronizar la bóveda con un servidor propio (Docker, en un homelab) sin que el servidor pueda leer nada (*zero-knowledge*). Antes de escribir red, servidor o interfaz hace falta la base: un **formato de registro cifrado**, una **jerarquía de claves** que permita compartir la bóveda entre equipos, y que la bóveda local **sepa qué cambió** (incluidos los borrados). Hoy no existe nada de esto: la clave de la bóveda es aleatoria por equipo, hosts y snippets están en claro en SQLite y los `DELETE` son definitivos.

Es el primer cambio de una línea de cinco (`sync-foundations` → `sync-server` → `sync-client-engine` → `sync-ui` → `sync-hardening-docs`). Este no abre ninguna conexión de red.

## What Changes

- **Crate `crates/sync-proto`** (Rust, sin red), usado después por la app y por el servidor:
  - **Sobre de registro versionado**: metadatos en claro mínimos (`id`, `kind`, `rev`, `updated_at`, `deleted`) y el registro completo cifrado con AES-256-GCM; el AAD liga el cifrado a `kind|id|rev`. Lleva identificador de algoritmo y versión (`v`, `alg`) para poder migrar.
  - **Secret Key** (128 bits, en base32 con prefijo y suma de comprobación, p. ej. `NXT1-…`), **AUK** (`HKDF(Argon2id(contraseña, sal) ‖ Secret Key)`), **clave de autenticación** y **clave de envoltura** derivadas de la AUK con contextos distintos.
  - **Paquete de clave** (*key bundle*): `VaultKey` envuelta con la clave de envoltura más los **parámetros del KDF** (algoritmo, memoria, iteraciones, paralelismo, sal), de modo que se puedan endurecer sin romper cuentas.
  - **Clave de recuperación** (*Recovery Key*, 256 bits, `NXR1-…` con suma de comprobación): una segunda envoltura de la `VaultKey`, independiente de la contraseña y de la Secret Key, que se guarda offline y permite fijar una contraseña nueva si se pierde la anterior. El servidor solo ve otro bloque cifrado.
  - **Kit de emergencia**: generador del texto imprimible (URL del servidor, usuario, Secret Key y, si se genera, la clave de recuperación, con avisos de custodia). **Nunca incluye la contraseña maestra.** La salida a PDF o impresión y su pantalla llegan en `sync-ui`.
  - Tipos del protocolo que usarán cliente y servidor (sin lógica de red).
- **Bóveda local** (migración idempotente): tabla `sync_state` (una fila: id de dispositivo, URL, `last_seq`, `applying`), tabla `sync_tombstones` y columnas `sync_rev`/`sync_dirty` en `folders`, `identities`, `hosts`, `ssh_tunnels` y `snippets` (solo no integrados). **Disparadores SQLite** marcan los registros como pendientes y registran los borrados (también los *en cascada*) sin tocar `inventory.rs`, salvo cuando `applying = 1` (cambios que vienen del servidor).
- Funciones Rust para exportar/importar un registro como sobre cifrado y para listar cambios pendientes; **sin comandos Tauri ni interfaz** en este cambio.
- Nuevas dependencias: `hkdf` y `data-encoding` (ver «Licencias»). Sin cambios de comportamiento visibles para el usuario.

## Capabilities

### New Capabilities
- `vault-sync`: sobre de registro cifrado, jerarquía de claves de sincronización y seguimiento local de cambios y borrados.

### Modified Capabilities
- (ninguna; la bóveda existente no cambia de comportamiento)

## Impact

- Nuevos: `crates/sync-proto/` (envelope, keys, bundle, types y pruebas), `src-tauri/src/sync/mod.rs` (exportar/importar registros y cambios pendientes) y su migración en `src-tauri/src/vault/db.rs`.
- Modificados: `src-tauri/Cargo.toml` (dependencia por ruta a `sync-proto`), `ARCHITECTURE.md` (módulo de sincronización), documentación del modelo de amenazas inicial en `docs/` (qué ve un servidor comprometido).
- Sin cambios en frontend.

## Licencias (nuevas dependencias)

| Paquete | Licencia | Compatible con GPLv3 |
|---|---|---|
| `hkdf` (RustCrypto) | MIT OR Apache-2.0 | Sí |
| `data-encoding` | MIT | Sí |

`argon2`, `aes-gcm`, `sha2`, `rand`, `zeroize`, `serde` y `base64` ya están en el proyecto. Se verifica con `cargo license` antes de archivar.
