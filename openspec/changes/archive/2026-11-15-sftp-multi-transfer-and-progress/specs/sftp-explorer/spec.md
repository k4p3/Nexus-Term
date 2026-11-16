# Spec Delta: sftp-explorer

## MODIFIED Requirements

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
