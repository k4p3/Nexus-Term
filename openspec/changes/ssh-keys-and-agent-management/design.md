# Design: SSH Keys, Public Key Derivation & System Agent Integration

## Context

Actualmente NexusTerm almacena las credenciales en la tabla `identities` de SQLite, cifrando el campo `secret` mediante AES-256-GCM. Al crear una identidad con clave privada, no se almacena de forma explícita la clave pública, por lo que el usuario no puede volver a consultarla ni copiarla tras cerrar el modal de creación. Además, la carga de llaves privadas se limita a pegar texto en un `textarea`, y el modo `auth_type: "agent"` no está conectado con el socket del agente SSH local del sistema operativo (`SSH_AUTH_SOCK`).

## Goals / Non-Goals

**Goals:**
- Almacenar la clave pública OpenSSH en la base de datos SQLite (`identities.public_key`) para que siempre esté accesible y lista para copiarse con 1 clic.
- Soportar generación nativa de claves tanto en Ed25519 como RSA (4096 bits) desde el backend en Rust.
- Proveer una función de utilidad para extraer la clave pública OpenSSH a partir de cualquier archivo o texto de clave privada (OpenSSH o PEM PKCS#1/#8).
- Permitir la importación directa de archivos de llaves (`id_ed25519`, `id_rsa`, `.pem`) en el modal de credenciales.
- Conectar `russh` con el socket del agente SSH local (`$SSH_AUTH_SOCK` en Linux/macOS y named pipe en Windows) para el método de autenticación por agente.

**Non-Goals:**
- Implementar un demonio servidor de SSH Agent propio dentro de NexusTerm (la aplicación actúa exclusivamente como cliente del agente SSH ya configurado por el usuario en su sistema operativo).

## Decisions

### Decisión 1: Columna `public_key` en SQLite vs Derivación en Cada Consulta
- **Elección**: Añadir la columna `public_key TEXT` en la tabla `identities`.
- **Razón**: La clave pública no es un secreto; tenerla almacenada en texto plano permite listarla y mostrarla instantáneamente en la interfaz sin tener que descifrar con AES-256-GCM la clave privada cada vez que se abre la lista de credenciales o el modal.

### Decisión 2: Generación Dual (Ed25519 y RSA 4096)
- **Implementación**:
  - `russh_keys::PrivateKey::random(&mut rng, russh_keys::Algorithm::Ed25519)` para Ed25519.
  - `russh_keys::PrivateKey::random(&mut rng, russh_keys::Algorithm::Rsa { hash: russh_keys::HashAlg::Sha256 })` para RSA.
- **Razón**: Ed25519 es el estándar moderno más seguro y rápido, mientras que RSA 4096 garantiza compatibilidad con dispositivos de red o servidores corporativos heredados que aún no soportan curvas elípticas.

### Decisión 3: Integración con el Agente SSH del Sistema
- **Implementación**:
  - En Linux y macOS, si `auth_type == "agent"`, el cliente consulta la variable de entorno `std::env::var("SSH_AUTH_SOCK")`.
  - Si existe, se abre una conexión de stream Unix a dicho socket y se invoca el cliente de agente de `russh` (`russh::keys::agent::client::AgentClient::connect_env()`).
  - La sesión SSH utiliza `session.authenticate_future(username, key, ...)` mediante las llaves publicadas por el agente.
- **Razón**: Permite compatibilidad total con llaves de hardware (YubiKey), 1Password SSH Agent y agentes nativos de Manjaro KDE Plasma (`ksshaskpass`).

### Decisión 4: Carga de Archivos en Frontend
- **Implementación**:
  - Soporte de selector `<input type="file">` y arrastrar y soltar en `IdentityModal.vue`.
  - Lectura en memoria con `FileReader.readAsText()`, enviando el contenido a Rust para validar formato y extraer la clave pública antes de guardar.

## Risks / Trade-offs

- **[Riesgo] Claves privadas protegidas por Passphrase desconocida al momento de importar**:
  - *Mitigación*: Si `decode_secret_key` falla por clave protegida, el sistema notifica en la interfaz que se requiere ingresar la *Passphrase* para descifrar y validar la clave antes de guardarla.
- **[Riesgo] Ausencia de socket de agente SSH activo**:
  - *Mitigación*: Si el usuario selecciona `auth_type: "agent"` pero `$SSH_AUTH_SOCK` no está configurado o no responde, el sistema arroja un error descriptivo indicando que el agente local no está en ejecución.
