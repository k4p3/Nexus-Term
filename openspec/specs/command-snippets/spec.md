# command-snippets Specification

## Purpose
Gestionar la biblioteca de fragmentos y comandos reutilizables (snippets) en NexusTerm, permitiendo su almacenamiento persistente en SQLite, etiquetado, filtrado rápido, siembra de comandos comunitarios por defecto, habilitación/deshabilitación y la sustitución interactiva de variables dinámicas antes de su inserción en terminales locales o remotas.

## Requirements

### Requirement: Almacenamiento y Gestión de Snippets
El sistema SHALL permitir crear, listar, editar, eliminar y alternar el estado de activación de plantillas de comandos reutilizables asociadas a etiquetas, categorías y origen (comunitario o usuario).

#### Scenario: Creación de un snippet de comando personalizado
- **WHEN** el usuario registra un nuevo comando con nombre, plantilla de texto y etiquetas
- **THEN** el sistema persiste el snippet con `is_builtin = false` e `is_enabled = true`
- **AND** lo muestra inmediatamente en la biblioteca de snippets con opción de edición y eliminación completas.

#### Scenario: Búsqueda y filtrado de snippets por origen y estado
- **WHEN** el usuario interactúa con los filtros del panel de snippets
- **THEN** el sistema permite filtrar por texto de consulta, por origen ("Todos", "Comunidad", "Mis Snippets")
- **AND** oculta los snippets deshabilitados a menos que el usuario active explícitamente "Mostrar deshabilitados".

---

### Requirement: Built-in Community Snippets Library
El backend SHALL sembrar automáticamente un catálogo estándar de snippets comunitarios curados en la base de datos local SQLite si no existen previamente, marcados con `is_builtin = true`.

#### Scenario: Siembra inicial de comandos comunitarios
- **WHEN** la aplicación inicializa la base de datos o ejecuta las migraciones
- **THEN** el sistema verifica si la biblioteca cuenta con los snippets comunitarios base
- **AND** si no existen, inserta la colección de comandos para Docker (logs, exec, ps, prune), Sistema (journalctl, df, free, dmesg), Redes (ss, ip, curl, ufw) y Servicios (systemctl restart, status)
- **AND** asegura que la operación sea idempotente sin duplicar registros ni sobrescribir modificaciones existentes.

#### Scenario: Protección y duplicación de snippets comunitarios
- **WHEN** el usuario visualiza un snippet comunitario (`is_builtin = true`)
- **THEN** el sistema muestra un indicador visual "Comunidad"
- **AND** previene la eliminación destructiva directa del registro base, ofreciendo la opción de deshabilitarlo o duplicarlo como un snippet editable del usuario.

---

### Requirement: Enable and Disable Snippets
El sistema SHALL permitir a los usuarios habilitar o deshabilitar snippets individuales sin eliminarlos de la base de datos.

#### Scenario: Deshabilitar un snippet comunitario o personalizado
- **WHEN** el usuario cambia el interruptor de activación de un snippet a inactivo (`is_enabled = false`)
- **THEN** el sistema actualiza el registro en SQLite
- **AND** el snippet deja de aparecer en la lista de inserción rápida de la terminal y en la paleta activa.

#### Scenario: Reactivar un snippet previamente deshabilitado
- **WHEN** el usuario activa la vista "Mostrar deshabilitados" y enciende el interruptor de un snippet
- **THEN** el sistema actualiza `is_enabled = true` y el snippet vuelve a estar disponible para su ejecución inmediata.

---

### Requirement: Parametrización e Inserción Dinámica
El sistema SHALL detectar variables con formato `{{nombre}}` dentro de la plantilla del snippet y MUST solicitar los valores al usuario antes de enviarlo a la terminal activa.

#### Scenario: Inserción de snippet sin parámetros
- **WHEN** el usuario selecciona un snippet estático sin marcadores de variables
- **THEN** el sistema escribe directamente la cadena de texto en la terminal activa

#### Scenario: Inserción de snippet con variables dinámicas
- **WHEN** el usuario selecciona un snippet que contiene marcadores como `docker logs -f --tail {{lines}} {{container}}`
- **THEN** el sistema presenta un diálogo modal para ingresar los valores de cada parámetro y envía el comando sustituido a la terminal activa tras la confirmación

### Requirement: Snippet Insertion Without Execution
Selecting a snippet from the snippet drawer or the command palette SHALL insert its text at the active terminal's prompt and SHALL NOT execute it. Execution SHALL happen only when the user presses `Enter`.

#### Scenario: Insert a plain snippet
- **WHEN** the user selects an enabled snippet without parameters
- **THEN** its text appears at the prompt of the active terminal
- **AND** no newline is sent, so the command is not executed.

#### Scenario: Insert a snippet with parameters
- **WHEN** the user fills in the parameters of a snippet and confirms
- **THEN** the resulting command is inserted at the prompt without being executed.

#### Scenario: Safe paste checks apply
- **WHEN** the inserted text is multi-line or matches the risky-paste patterns and the paste warning is enabled
- **THEN** the paste confirmation is shown before anything is inserted.

#### Scenario: Multi-line snippets are not run line by line
- **WHEN** a multi-line snippet is inserted
- **THEN** it is sent as a bracketed paste so the shell does not execute each line.

#### Scenario: No active terminal
- **WHEN** there is no active terminal pane
- **THEN** nothing is inserted and the user is informed.

### Requirement: Snippet Import
The application SHALL let the user import snippets from a JSON file in the `nexusterm-snippets` version 1 format, validating it and showing a summary of what will be imported, skipped and rejected before any snippet is saved.

#### Scenario: Valid file
- **WHEN** the user selects a file with `"format": "nexusterm-snippets"`, `"version": 1` and a list of snippets with `title` and `command`
- **THEN** a summary shows how many snippets will be imported
- **AND** after the user confirms they are created as custom, enabled snippets.

#### Scenario: Duplicates are skipped
- **WHEN** an imported snippet has the same title and command as an existing one, or appears twice in the file
- **THEN** it is skipped and counted in the summary
- **AND** no existing snippet is modified.

#### Scenario: Invalid entries
- **WHEN** an entry lacks `title` or `command`, has the wrong type, or exceeds the size limits
- **THEN** that entry is reported with its reason and not imported
- **AND** the valid entries can still be imported.

#### Scenario: Unsafe characters
- **WHEN** an entry's title, command or description contains a line break, a control character (including `ESC`), a bidirectional-control character or a zero-width/invisible character
- **THEN** that entry is reported as invalid with its reason and is not imported.

#### Scenario: Review before confirming
- **WHEN** the summary is shown
- **THEN** every command to import is listed in full
- **AND** commands matching risky patterns (privilege escalation, recursive deletion, piping a download into a shell) are flagged with a warning.

#### Scenario: Imported snippets are marked
- **WHEN** snippets are imported
- **THEN** they carry the reserved tag `imported`
- **AND** the snippet drawer shows an "imported" badge on them.

#### Scenario: Rejected file
- **WHEN** the file is not valid JSON, is larger than 1 MB, has another `format`, has an unknown `version`, or contains more than 500 snippets
- **THEN** nothing is imported and the reason is shown.

#### Scenario: Nothing is executed
- **WHEN** a snippet is imported
- **THEN** its command is stored as text only and is never run, inserted into a terminal or interpreted.

### Requirement: Snippet Export
The application SHALL let the user export their custom snippets to a JSON file in the `nexusterm-snippets` version 1 format. Built-in snippets SHALL NOT be exported.

#### Scenario: Export and re-import
- **WHEN** the user exports their custom snippets and imports the file in another installation
- **THEN** the same snippets are created there
- **AND** importing it again skips all of them as duplicates.

#### Scenario: Nothing to export
- **WHEN** the user has no custom snippets
- **THEN** the export action is disabled.
