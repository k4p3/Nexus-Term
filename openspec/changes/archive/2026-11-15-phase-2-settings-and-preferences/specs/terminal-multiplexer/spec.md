# Terminal Multiplexer Specification

## ADDED Requirements

### Requirement: Aplicación Dinámica de Preferencias en Paneles Activos
Las instancias activas de terminal MUST reaccionar en caliente a los cambios en la configuración de apariencia (fuente, tamaño, cursor y paleta de colores) aplicando las nuevas opciones y recalculando el ajuste de dimensiones sin interrumpir la conexión de red o proceso en curso.

#### Scenario: Cambio en caliente de tema y tamaño de fuente
- **WHEN** el usuario modifica el tema de color o el tamaño de letra en la configuración
- **THEN** todas las terminales abiertas actualizan su tema, fuente y dimensiones ajustadas inmediatamente sin cerrar ni reiniciar sus sesiones
