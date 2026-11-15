# Proposal: Importador de ~/.ssh/config y known_hosts

## Why

Muchos desarrolladores y administradores de sistemas ya cuentan con decenas de servidores, alias, bastiones y configuraciones en `~/.ssh/config`, así como huellas digitales de servidores confiables en `~/.ssh/known_hosts`. Actualmente, migrar a NexusTerm requiere reescribir manualmente cada servidor, host, puerto, usuario y ruta de clave en la interfaz, lo cual genera fricción de adopción.

Este cambio proporciona un importador nativo e inteligente que analiza `~/.ssh/config` y `~/.ssh/known_hosts`, presenta una vista previa con casillas de selección y migra los hosts, carpetas e identidades a la bóveda cifrada en un solo clic sin duplicados.

## What Changes

- **Parser Nativo de OpenSSH Client Config (`~/.ssh/config`)**:
  - Detección automática del archivo en `$HOME/.ssh/config` (Linux/macOS) y `%USERPROFILE%\.ssh\config` (Windows).
  - Reconocimiento de directivas estándar: `Host`, `HostName`, `User`, `Port`, `IdentityFile`, `ProxyJump`, `ForwardAgent`.
  - Soporte de comentarios y exclusión de patrones comodín globales (`Host *`).
- **Parser de `known_hosts`**:
  - Lectura de claves públicas y huellas digitales confiables de servidores ya visitados para pre-poblar la tabla `known_hosts` de la bóveda de NexusTerm (previniendo alertas innecesarias de TOFU).
- **Modal de Importación Interactiva con Vista Previa**:
  - Diálogo de previsualización que muestra los servidores detectados con casillas de verificación para seleccionar cuáles importar.
  - Creación automática de carpeta organizada `"Importados de SSH Config"` (opcional o configurable).
  - Creación automática o vinculación de identidades asociadas a `IdentityFile` o `User`.
- **Detección de Duplicados**:
  - Opciones para omitir o actualizar hosts que ya coincidan en `hostname` y `port`.

## Capabilities

### New Capabilities
*(Ninguna; se amplía el catálogo de requerimientos de la capacidad existente `host-inventory`).*

### Modified Capabilities
- `host-inventory`: Ampliar la capacidad para soportar la detección, análisis, vista previa e importación por lotes de servidores, identidades y claves conocidas desde archivos de configuración OpenSSH locales (`~/.ssh/config` y `known_hosts`).

## Impact

- **Backend**:
  - Nuevo módulo `src-tauri/src/ssh_config/mod.rs` con parsers para `config` y `known_hosts`.
  - Nuevos comandos Tauri IPC:
    - `detect_ssh_config() -> Result<SshConfigPreview, String>`
    - `import_ssh_config(payload: ImportSshConfigPayload) -> Result<ImportSummary, String>`
- **Frontend**:
  - Nuevo componente `src/components/hosts/SshConfigImportModal.vue`.
  - Botón de acción rápida "Importar desde ~/.ssh/config" en la cabecera del inventario (`HostTreeSidebar.vue`).
  - Servicios tipados en `src/services/ssh_config.service.ts` y tipos en `src/types/ssh_config.ts`.
