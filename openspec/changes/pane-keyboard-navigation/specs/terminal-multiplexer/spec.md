## ADDED Requirements

### Requirement: Navegación por Teclado entre Paneles Divididos
El sistema SHALL permitir cambiar el panel activo de una pestaña dividida con `Alt` + flechas, moviendo el foco al panel contiguo en la dirección pulsada, y MUST dejar pasar la pulsación a la sesión cuando no exista un panel en esa dirección.

#### Scenario: Cambio de panel hacia un vecino existente
- **WHEN** el usuario pulsa `Alt+→` en un panel que tiene otro a su derecha dentro de la misma pestaña
- **THEN** el sistema marca ese panel como activo, le da el foco de teclado AND la pulsación no se envía a la sesión

#### Scenario: Sin panel en esa dirección
- **WHEN** el usuario pulsa `Alt+←` en el panel situado más a la izquierda, o en una pestaña con un solo panel
- **THEN** el sistema no cambia el panel activo AND la pulsación se envía a la sesión sin modificar

#### Scenario: Varios vecinos posibles
- **WHEN** hay varios paneles en la dirección pulsada (p. ej. un panel a la izquierda y dos apilados a la derecha)
- **THEN** el sistema elige el panel contiguo más cercano en esa dirección que se solape con el panel activo y, ante un empate, el que tenga el centro más próximo al del panel activo

#### Scenario: Indicación visible del panel activo
- **WHEN** cambia el panel activo
- **THEN** la cabecera del panel recién activo se muestra resaltada y la del anterior vuelve al estilo neutro
