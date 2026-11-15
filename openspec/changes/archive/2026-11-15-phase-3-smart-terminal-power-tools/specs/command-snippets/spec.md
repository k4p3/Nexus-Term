# command-snippets Specification

## ADDED Requirements

### Requirement: Almacenamiento y Gestión de Snippets
El sistema SHALL permitir crear, listar, editar y eliminar plantillas de comandos reutilizables asociadas a etiquetas y categorías.

#### Scenario: Creación de un snippet de comando
- **WHEN** el usuario registra un nuevo comando con nombre, plantilla de texto y etiquetas
- **THEN** el sistema persiste el snippet en la base de datos y lo muestra inmediatamente en la biblioteca de snippets

#### Scenario: Búsqueda y filtrado de snippets
- **WHEN** el usuario ingresa un término de búsqueda en la biblioteca de snippets
- **THEN** el sistema filtra en tiempo real los snippets cuyo título, plantilla o etiquetas coincidan con la consulta

### Requirement: Parametrización e Inserción Dinámica
El sistema SHALL detectar variables con formato `{{nombre}}` dentro de la plantilla del snippet y MUST solicitar los valores al usuario antes de enviarlo a la terminal activa.

#### Scenario: Inserción de snippet sin parámetros
- **WHEN** el usuario selecciona un snippet estático sin marcadores de variables
- **THEN** el sistema escribe directamente la cadena de texto en la terminal activa

#### Scenario: Inserción de snippet con variables dinámicas
- **WHEN** el usuario selecciona un snippet que contiene marcadores como `docker logs -f --tail {{lines}} {{container}}`
- **THEN** el sistema presenta un diálogo modal para ingresar los valores de cada parámetro y envía el comando sustituido a la terminal activa tras la confirmación
