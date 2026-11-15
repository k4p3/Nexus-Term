# Design: Importador de ~/.ssh/config y known_hosts

## Context

Actualmente los usuarios de OpenSSH disponen de configuraciones consolidadas en `~/.ssh/config` y `~/.ssh/known_hosts`. NexusTerm cuenta con un almacén relacional cifrado en SQLite (`vault.db`), pero carece de un canal para leer y procesar estas fuentes externas locales.

Ver motivación completa en [proposal.md](proposal.md).

## Goals / Non-Goals

**Goals:**
- Implementar un parser nativo en Rust puro para archivos de configuración de cliente OpenSSH (`~/.ssh/config`), sin añadir crates de terceros pesados o incompatibles con GPLv3.
- Analizar `known_hosts` y pre-poblar la tabla `known_hosts` de SQLite para mantener la confianza en servidores ya verificados.
- Ofrecer una vista previa interactiva en el frontend con selección por casillas, detección de duplicados existentes y opción de agrupar en una carpeta específica.
- Importar y vincular identidades creadas a partir de las directivas `User` e `IdentityFile`.

**Non-Goals:**
- Modificar o escribir en los archivos `~/.ssh/config` o `known_hosts` del sistema (operación 100% de solo lectura y migración hacia la bóveda de NexusTerm).
- Ejecutar directivas arbitrarias `LocalCommand` o scripts de `ProxyCommand` por razones de seguridad en la importación inicial.

## Decisions

### Decisión 1: Parser Nativo de Configuración vs Dependencia Externa
- **Elección**: Parser nativo modular en `src-tauri/src/ssh_config/parser.rs`.
- **Razón**: El formato de `~/.ssh/config` consiste en pares clave-valor estructurados en torno a cláusulas `Host <alias>`. Escribir nuestro propio parser garantiza 0 dependencias externas, cero problemas de licencias FOSS y un control riguroso sobre las directivas seguras admitidas (`Host`, `HostName`, `User`, `Port`, `IdentityFile`, `ProxyJump`).

### Decisión 2: Proceso en Dos Etapas (Preview y Commit)
- **Implementación**:
  1. `detect_ssh_config`: Lee el archivo, detecta duplicados contra la base de datos `hosts` actual y retorna un preview ligero sin modificar la base de datos.
  2. `import_ssh_config`: Recibe la selección explícita del usuario, crea la carpeta contenedora si fue solicitada, registra las identidades con sus claves y guarda los hosts en SQLite.
- **Razón**: Da control total al usuario para desmarcar alias temporales o comodines (`Host *`) antes de alterar su bóveda de servidores.

### Decisión 3: Manejo de `IdentityFile`
- **Implementación**:
  - Si un host especifica `IdentityFile ~/.ssh/id_ed25519`:
  - Se expande la ruta al directorio home del usuario.
  - Si el archivo existe y es legible, se lee su clave pública y privada; si la clave está protegida por frase de paso, se importa como identidad tipo `private_key` con la clave pública derivada visible y solicitud de passphrase al conectar.
  - Si múltiples hosts usan la misma ruta de `IdentityFile`, se reutiliza la misma identidad en lugar de duplicarla.

### Decisión 4: Pre-población de `known_hosts`
- **Implementación**:
  - Parseo línea a línea de `~/.ssh/known_hosts`.
  - Inserción con `INSERT OR IGNORE` en la tabla `known_hosts` de SQLite, calculando el fingerprint SHA-256 cuando no esté almacenado en hash de OpenSSH.
- **Razón**: Permite conectarse a servidores ya conocidos desde la terminal del sistema sin recibir advertencias alarmistas de Trust On First Use (TOFU).

## Contratos IPC (Tauri <-> TypeScript)

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ParsedHostEntry {
    pub alias: String,
    pub hostname: String,
    pub port: u16,
    pub user: Option<String>,
    pub identity_file: Option<String>,
    pub proxy_jump: Option<String>,
    pub is_duplicate: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SshConfigPreview {
    pub config_path: String,
    pub known_hosts_path: String,
    pub hosts: Vec<ParsedHostEntry>,
    pub known_hosts_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportSshConfigPayload {
    pub selected_hosts: Vec<ParsedHostEntry>,
    pub folder_name: Option<String>, // default "Importados de SSH Config"
    pub import_known_hosts: bool,
    pub overwrite_duplicates: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportSummary {
    pub hosts_imported: usize,
    pub identities_created: usize,
    pub known_hosts_imported: usize,
}
```

## Risks / Trade-offs

- **[Riesgo] Archivos `IdentityFile` protegidos con contraseña desconocida**:
  - *Mitigación*: Se importa el contenido de la clave privada y se deja marcada la necesidad de ingresar passphrase en la sesión interactiva al conectar.
- **[Riesgo] Directivas complejas de `ProxyCommand`**:
  - *Mitigación*: Se analizan directivas `ProxyJump` como Jump Hosts estándar; `ProxyCommand` complejos se importan como nota del servidor sin ejecución ciega.
