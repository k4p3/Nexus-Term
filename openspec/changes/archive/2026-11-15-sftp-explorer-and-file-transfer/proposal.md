# Proposal: Explorador SFTP Integrado y Transferencia de Archivos

## Why

Los administradores de sistemas y desarrolladores que operan servidores remotos requieren constantemente examinar directorios, editar o descargar logs, transferir artefactos de despliegue y gestionar permisos sin abandonar la aplicación de terminal ni recurrir a clientes de terceros pesados como FileZilla o Cyberduck.

Actualmente NexusTerm cuenta con terminal interactiva, gestión de identidades y reenvío de puertos. Incorporar un explorador de archivos SFTP integrado que aproveche el canal subsistema SFTP sobre la misma conexión SSH autenticada permite navegar el árbol remoto con baja latencia, transferir archivos con arrastrar y soltar o mediante barra de herramientas, y monitorear transferencias en tiempo real sin requerir credenciales adicionales.

## What Changes

- **Subsistema SFTP Nativo en Rust**:
  - Implementación del cliente SFTP en `src-tauri/src/sftp/` utilizando `russh-sftp` montado sobre la conexión SSH autenticada de `russh`.
  - Operaciones completas de sistema de archivos remoto:
    - Listar contenido de directorios con metadatos (tamaño, fecha de modificación, permisos UNIX, tipo archivo/directorio/enlace).
    - Creación de nuevos directorios (`mkdir`).
    - Eliminación de archivos y directorios (`remove_file`, `remove_dir`).
    - Renombrado y movimiento de archivos (`rename`).
    - Lectura y escritura de contenido para transferencias de archivos.
- **Cola de Transferencias Asíncrona con Streaming**:
  - Descarga (`download_file`) de remoto a local y subida (`upload_file`) de local a remoto.
  - Notificación de progreso en tiempo real mediante `tauri::ipc::Channel` o eventos Tauri (bytes transferidos, total, porcentaje).
- **Frontend y Experiencia de Usuario**:
  - Store Pinia `src/stores/sftp.store.ts` para gestionar sesiones SFTP, directorio actual, historial de navegación (breadcrumbs), archivos seleccionados y cola de transferencias activas.
  - Componentes de UI:
    - `src/components/sftp/SftpSidebar.vue`: Barra lateral acoplada a la terminal para explorar rápidamente el servidor conectado.
    - `src/components/sftp/TransferQueue.vue`: Panel de progreso de subidas y descargas en segundo plano.
    - Modal de confirmación para eliminar y renombrar.
  - Botón de acceso a SFTP desde las pestañas de sesión SSH y la barra de herramientas.
- **Pruebas Automatizadas y Licencias**:
  - Pruebas unitarias en Rust para modelos y lógica de navegación.
  - Pruebas unitarias en Vitest para `sftp.store.ts`.
  - Dependencia `russh-sftp` v2.4 (licencia Apache-2.0, 100% compatible con GPLv3).

## Capabilities

### New Capabilities
- `sftp-explorer`: Navegación remota de directorios, gestión de archivos (crear, renombrar, borrar, metadatos) y transferencias bidireccionales con reporte de progreso sobre el canal subsistema SFTP.

### Modified Capabilities
<!-- Ninguna capacidad existente cambia sus requisitos -->

## Impact

- **Backend (Rust)**:
  - Adición de `russh-sftp` en `src-tauri/Cargo.toml`.
  - Creación del módulo `src-tauri/src/sftp/` (`mod.rs`, `models.rs`, `client.rs`, `commands.rs`).
  - Registro de comandos Tauri IPC en `src-tauri/src/lib.rs`.
- **Frontend (Vue 3 / TypeScript)**:
  - Creación de `src/types/sftp.ts`, `src/services/sftp.service.ts`, `src/stores/sftp.store.ts`.
  - Componentes en `src/components/sftp/`.
- **Compatibilidad**:
  - Compatible con cualquier servidor OpenSSH estándar que tenga habilitado el subsistema `sftp` (predeterminado en todas las distribuciones Linux y Unix).
