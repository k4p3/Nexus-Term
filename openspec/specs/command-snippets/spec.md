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
