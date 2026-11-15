# Spec Delta: app-settings

## MODIFIED Requirements

### Requirement: Ajustes de Apariencia de la Terminal
El sistema SHALL permitir configurar la familia tipográfica, tamaño de fuente, altura de línea, estilo de cursor (block, bar, underline), parpadeo del cursor y tema de color unificado tanto para la terminal como para la interfaz gráfica completa de la aplicación.

#### Scenario: Cambio de estilo y tamaño de fuente
- **WHEN** el usuario selecciona una nueva fuente o incrementa el tamaño de letra en la configuración
- **THEN** el sistema actualiza las opciones de terminal en el almacén de configuración

#### Scenario: Selección de tema de color predefinido
- **WHEN** el usuario selecciona un tema de color (como Dracula, Nord o Catppuccin)
- **THEN** el sistema asigna la paleta de 16 colores ANSI a la terminal xterm.js e inyecta dinámicamente en el DOM las variables CSS de superficie, fondo, bordes y acento correspondientes a toda la interfaz gráfica

#### Scenario: Adaptación de tema personalizado importado
- **WHEN** el usuario importa y activa un tema personalizado en formato JSON
- **THEN** el sistema deriva y aplica automáticamente una paleta de interfaz armónica (superficie, fondo, bordes y color de acento) reflejada de forma reactiva en toda la ventana
