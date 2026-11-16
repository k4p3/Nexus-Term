# sftp-explorer Specification

## Purpose
Permite a los usuarios examinar el sistema de archivos remoto, gestionar archivos y carpetas, y transferir archivos bidireccionalmente con progreso en tiempo real sobre el subsistema SFTP de una sesión SSH.

## Requirements

### Requirement: Conexión al subsistema SFTP
The system SHALL open an SFTP subsystem channel over an authenticated SSH session associated with an inventory host, keeping the SFTP session handle active for filesystem queries.

#### Scenario: Apertura exitosa de canal SFTP
- **WHEN** el usuario abre el explorador SFTP para un servidor SSH conectado o registrado en el inventario
- **THEN** el sistema autentica la conexión SSH si no está activa, solicita la apertura del canal subsistema "sftp" y queda listo para operaciones de archivos

#### Scenario: Servidor remoto sin subsistema SFTP habilitado
- **WHEN** el servidor SSH remoto rechaza la solicitud de apertura del subsistema SFTP
- **THEN** el sistema informa un error descriptivo indicando que el servidor remoto no tiene habilitado el subsistema SFTP

### Requirement: Navegación y listado de directorios remotos
The system SHALL list remote directory entries, returning for each item its name, full path, size in bytes, modification timestamp, file type (file, directory, symlink), and UNIX permission flags.

#### Scenario: Listar contenido de directorio remoto
- **WHEN** el usuario navega a una ruta remota (ej. `/var/log` o `~`)
- **THEN** el sistema retorna la lista ordenada de elementos diferenciando carpetas y archivos con sus metadatos asociados

#### Scenario: Acceso denegado a directorio sin permisos
- **WHEN** el usuario intenta listar un directorio remoto para el cual el usuario SSH carece de permisos de lectura
- **THEN** el sistema captura el error de permiso denegado y lo notifica visualmente sin cerrar la sesión SFTP

### Requirement: Gestión de archivos y directorios
The system SHALL allow users to create new directories, rename existing items, and delete files or directories on the remote host via SFTP.

#### Scenario: Crear nuevo directorio remoto
- **WHEN** el usuario ingresa un nombre para una nueva carpeta en la ruta remota actual
- **THEN** el sistema invoca la creación de directorio en el servidor remoto y refresca el listado automáticamente

#### Scenario: Eliminar archivo remoto
- **WHEN** el usuario confirma la eliminación de un archivo remoto
- **THEN** el sistema ejecuta la eliminación en el servidor SFTP y remueve el archivo de la vista

### Requirement: Transferencia bidireccional de archivos
The system SHALL support downloading remote files to the local filesystem and uploading local files to the remote server, emitting progress events reporting transferred bytes and total file size, and MUST support batch multi-file operations and Drag & Drop file uploads from the operating system file manager.

#### Scenario: Descarga de archivo remoto con progreso
- **WHEN** el usuario selecciona descargar un archivo remoto indicando la ruta destino local
- **THEN** el sistema transmite los datos en bloques, actualiza periódicamente el porcentaje y guarda el archivo en la máquina local

#### Scenario: Subida de archivo local al servidor remoto
- **WHEN** el usuario selecciona un archivo local para subirlo a la carpeta remota actual
- **THEN** el sistema crea el archivo remoto y transmite los bytes locales reportando el progreso hasta completarse con éxito

#### Scenario: Subida de múltiples archivos en lote y Drag & Drop
- **WHEN** el usuario selecciona múltiples archivos locales mediante el selector nativo o los arrastra y suelta (Drag & Drop) sobre la lista de archivos SFTP
- **THEN** el sistema encola cada uno de los archivos para subida hacia el directorio remoto actual y procesa la transferencia en lotes

#### Scenario: Descarga en lote de elementos remotos seleccionados
- **WHEN** el usuario selecciona múltiples archivos remotos en el explorador y pulsa la acción de descarga
- **THEN** el sistema resuelve dinámicamente el directorio de descargas del sistema operativo del usuario y encola la descarga secuencial o concurrente de cada archivo

### Requirement: Cola y estado de transferencias
The system SHALL maintain an active transfer queue recording current, queued, completed, and failed transfer tasks, detailing filename, direction (upload/download), progress percentage, and error messages if applicable, MUST process transfers respecting a configurable concurrency pool limit, and MUST display individual transfer state inline on file entries in the explorer view.

#### Scenario: Visualización de transferencias en la cola
- **WHEN** se inician una o más transferencias de archivos
- **THEN** la cola de transferencias muestra el estado de cada tarea, actualizando el progreso en vivo y permitiendo cancelar transferencias activas

#### Scenario: Concurrencia de transferencias controlada por pool
- **WHEN** se agregan más tareas de transferencia que el límite máximo de concurrencia configurado (por defecto 2)
- **THEN** el sistema mantiene en ejecución exactamente hasta dicho límite en paralelo, dejando las demás en estado "en cola", e iniciando automáticamente la siguiente tarea disponible al terminar cada una

#### Scenario: Estado de transferencia visible inline en el explorador
- **WHEN** un archivo remoto se encuentra en proceso de subida, descarga o recién completado
- **THEN** la fila correspondiente en la lista de archivos muestra un indicador inline de estado (icono animado, micro barra o porcentaje) sin requerir abrir la ventana flotante de la cola
