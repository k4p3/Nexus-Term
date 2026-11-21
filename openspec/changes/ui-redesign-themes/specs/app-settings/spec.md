## ADDED Requirements

### Requirement: Modo de Apariencia Claro, Oscuro y del Sistema
El sistema SHALL ofrecer temas de interfaz de modo claro y oscuro, y MUST permitir seguir la preferencia del sistema operativo (`prefers-color-scheme`) eligiendo un tema claro y uno oscuro asociados.

#### Scenario: Seguir al sistema
- **WHEN** el usuario activa "Seguir al sistema" y el sistema operativo cambia de modo
- **THEN** el sistema aplica el tema asociado al nuevo modo sin reiniciar y actualiza `color-scheme` del documento

#### Scenario: Legibilidad garantizada
- **WHEN** se define un tema integrado
- **THEN** el texto principal sobre el fondo y el texto sobre el acento MUST cumplir un contraste mínimo de 4.5:1

### Requirement: Persistencia de Temas Personalizados
El sistema SHALL persistir los temas personalizados importados en la base de datos local y MUST restaurarlos al iniciar, manteniendo compatibilidad con configuraciones anteriores que no contengan este campo.

#### Scenario: Tema personalizado tras reinicio
- **WHEN** el usuario importa un tema personalizado, lo activa y reinicia la aplicación
- **THEN** el sistema carga el tema personalizado y lo aplica a la terminal y a toda la interfaz

#### Scenario: Configuración anterior sin temas personalizados
- **WHEN** se carga una configuración guardada sin el campo de temas personalizados
- **THEN** el sistema utiliza una lista vacía y no produce errores

## MODIFIED Requirements

### Requirement: Ajustes de Apariencia de la Terminal
El sistema SHALL permitir configurar la familia tipográfica, tamaño de fuente, altura de línea, estilo de cursor (block, bar, underline), parpadeo del cursor, densidad de interfaz (cómoda o compacta) y tema de color unificado tanto para la terminal como para la interfaz gráfica completa, la cual MUST derivar todos sus colores de tokens de tema sin valores de color fijos en los componentes.

#### Scenario: Cambio de estilo y tamaño de fuente
- **WHEN** el usuario selecciona una nueva fuente o incrementa el tamaño de letra en la configuración
- **THEN** el sistema actualiza las opciones de terminal en el almacén de configuración

#### Scenario: Selección de tema de color predefinido
- **WHEN** el usuario selecciona un tema de color (como Dracula, Nord, Catppuccin o Nexus Paper)
- **THEN** el sistema asigna la paleta ANSI a la terminal xterm.js e inyecta en el DOM todos los tokens de superficie, texto, bordes, acento y colores semánticos de toda la interfaz

#### Scenario: Adaptación de tema personalizado importado
- **WHEN** el usuario importa y activa un tema personalizado en formato JSON
- **THEN** el sistema deriva una paleta de interfaz armónica, incluido su modo claro u oscuro por luminancia, y la aplica de forma reactiva en toda la ventana
