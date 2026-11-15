# Proposal: SSH Keys, Public Key Derivation & System Agent Integration

## Why

El modelo actual de identidades de autenticación almacena la clave privada en la bóveda cifrada, pero no persiste ni deriva la clave pública correspondiente para visualización recurrente. Además, obliga al usuario a copiar y pegar cadenas de texto de llaves en un área de texto en lugar de importar archivos de clave directamente del sistema de archivos (`id_ed25519`, `id_rsa`, `.pem`), y carece de conexión activa con el agente SSH del sistema operativo (`SSH_AUTH_SOCK` / Pageant) para usuarios con llaves de hardware (YubiKey) o gestores externos.

Este cambio moderniza integralmente la gestión de llaves públicas y privadas y la integración con el agente SSH, facilitando la copia de la clave pública para `~/.ssh/authorized_keys`, la importación directa de archivos de claves y la delegación al agente local.

## What Changes

- **Persistencia y Derivación de Clave Pública**: Almacenar o derivar la clave pública OpenSSH (`ssh-ed25519 AAAA...` / `ssh-rsa AAAA...`) y mantenerla visible de forma permanente en la credencial con un botón "Copiar Clave Pública" de un clic.
- **Importador de Archivos de Claves**: Permitir al usuario seleccionar archivos de clave privada (`id_ed25519`, `id_rsa`, `.pem`) mediante el selector de archivos nativo o arrastrar y soltar, con extracción automática de la clave pública.
- **Generación Dual de Llaves**: Soporte para generar pares de claves tanto en Ed25519 (moderno y recomendado) como RSA 4096 (compatibilidad con servidores heredados) directamente dentro de la interfaz.
- **Integración con el Agente SSH del Sistema**: Habilitar en el backend de Rust (`russh`) la autenticación delegada al socket Unix `$SSH_AUTH_SOCK` (o pipe de Windows) cuando la identidad se configure en modo `agent`, soportando llaves YubiKey / FIDO2 y 1Password.
- **Badges Visuales en el Inventario**: Etiquetas visuales en la barra lateral de credenciales para identificar claramente el tipo de credencial (`🔑 ed25519`, `🔑 rsa`, `🛡️ ssh-agent`, `🔒 password`).

## Capabilities

### New Capabilities
*(Ninguna; se amplía el catálogo de requerimientos de la capacidad existente).*

### Modified Capabilities
- `host-inventory`: Ampliar el requerimiento de gestión de identidades reutilizables para contemplar la visualización y copia persistente de claves públicas, la importación de archivos de clave privada y la autenticación mediante el socket del agente SSH del sistema.

## Impact

- **Backend**:
  - `src-tauri/src/vault/inventory.rs` y base de datos SQLite: Añadir campo `public_key` en la tabla `identities` (o derivarlo al vuelo al descifrar `secret`).
  - `src-tauri/src/ssh/mod.rs`: Soporte para conexión con socket de `SSH_AUTH_SOCK` mediante `russh` cuando `auth_type == "agent"`.
  - `src-tauri/src/session.rs`: Extender comando `generate_ssh_key` para soportar tanto `"ed25519"` como `"rsa"`.
- **Frontend**:
  - `src/types/inventory.ts`: Extensión de `IdentitySummary` y `SaveIdentityPayload` con `public_key?: string`.
  - `src/components/hosts/IdentityModal.vue`: Selector de archivos, selector de algoritmo (Ed25519 / RSA 4096), visualización fija de clave pública con copiado rápido.
  - `src/components/hosts/HostTreeSidebar.vue`: Badges en la pestaña de credenciales.
