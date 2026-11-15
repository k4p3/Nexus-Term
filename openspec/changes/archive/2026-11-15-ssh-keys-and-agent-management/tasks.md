# Tasks: SSH Keys, Public Key Derivation & System Agent Integration

## 1. Esquema de Base de Datos y Backend Rust

- [x] 1.1 Migrar la tabla `identities` en `src-tauri/src/vault/db.rs` para soportar la columna `public_key TEXT`
- [x] 1.2 Actualizar los structs `IdentityRecord`, `IdentitySummary` y los métodos CRUD en `src-tauri/src/vault/inventory.rs` para persistir y retornar `public_key`
- [x] 1.3 Extender el comando IPC `generate_ssh_key` en `src-tauri/src/session.rs` para soportar algoritmos `"ed25519"` y `"rsa"` (4096 bits)
- [x] 1.4 Implementar la función de extracción y validación de clave pública OpenSSH a partir de claves privadas en el backend
- [x] 1.5 Implementar la autenticación con el socket del agente SSH local (`SSH_AUTH_SOCK`) en `src-tauri/src/ssh/mod.rs` para identidades de tipo `agent`

## 2. Tipos de Datos y Servicios en el Frontend

- [x] 2.1 Actualizar las interfaces `IdentitySummary` y `SaveIdentityPayload` en `src/types/inventory.ts` con el campo `public_key`
- [x] 2.2 Extender el servicio `sessionService.generateSshKey` para admitir el parámetro de algoritmo (`ed25519` o `rsa`)

## 3. Interfaz de Usuario y Componentes

- [x] 3.1 Actualizar `IdentityModal.vue` con selector de archivo de clave, selector de algoritmo de generación y visualizador fijo de clave pública con botón de copiado
- [x] 3.2 Añadir validación y extracción automática de la clave pública al pegar o importar una clave privada en el modal
- [x] 3.3 Añadir badges del método de autenticación (`ed25519`, `rsa`, `agent`, `password`) en la lista de credenciales de `HostTreeSidebar.vue`

## 4. Verificación y Validación

- [x] 4.1 Ejecutar pruebas unitarias del backend en Rust (`cargo test`) verificando la persistencia de `public_key` y generación de claves
- [x] 4.2 Ejecutar verificación de tipos TypeScript y empaquetado del frontend (`./node_modules/.bin/vue-tsc --noEmit && ./node_modules/.bin/vite build`)
- [x] 4.3 Validar formalmente la propuesta y especificaciones con `openspec validate --all --strict`
