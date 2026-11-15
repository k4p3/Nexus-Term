# terminal-multiplexer Specification

## ADDED Requirements

### Requirement: Integración con el Shell mediante OSC 133
El sistema SHALL interpretar secuencias de escape OSC 133 (FinalTerm / semantic prompts) para identificar el inicio de un prompt, el inicio de un comando, el fin de ejecución y el código de retorno.

#### Scenario: Detección de comando finalizado con éxito
- **WHEN** el shell emite `OSC 133;D;0` indicando finalización con código de salida 0
- **THEN** el sistema registra el comando como exitoso y actualiza los marcadores de navegación de prompt

#### Scenario: Detección de comando finalizado con error
- **WHEN** el shell emite `OSC 133;D;1` u otro código distinto de cero
- **THEN** el sistema registra el comando como fallido y permite inspeccionar visualmente el estado del comando

#### Scenario: Salto entre comandos mediante teclado
- **WHEN** el usuario pulsa `Ctrl+Shift+Up` o `Ctrl+Shift+Down` en un panel con integración de shell
- **THEN** el scroll de la terminal se desplaza inmediatamente a la línea donde inició el comando anterior o siguiente

### Requirement: Búsqueda Interactiva en el Buffer de Terminal
El sistema SHALL proporcionar una barra de búsqueda sobre el panel de terminal activo para localizar texto en el historial del buffer mediante `@xterm/addon-search`.

#### Scenario: Apertura de barra de búsqueda y coincidencia
- **WHEN** el usuario pulsa `Ctrl+F` en una terminal activa e introduce un término de búsqueda
- **THEN** el sistema resalta todas las coincidencias visibles y enfoca la primera ocurrencia en el buffer

#### Scenario: Navegación entre resultados de búsqueda
- **WHEN** el usuario pulsa Enter o los botones de navegación siguiente/anterior en la barra de búsqueda
- **THEN** el emulador desplaza la vista a la siguiente o anterior coincidencia encontrada

### Requirement: Modo Broadcast para Paneles Divididos
El sistema SHALL permitir activar el modo Broadcast para replicar la entrada de teclado del panel activo hacia todos los demás paneles divididos de la pestaña actual.

#### Scenario: Replicación de pulsaciones de teclado en modo Broadcast
- **WHEN** el modo Broadcast está activo en una pestaña con dos o más paneles divididos y el usuario escribe texto en el panel activo
- **THEN** el sistema envía los mismos bytes de entrada simultáneamente a todas las sesiones de los paneles divididos de dicha pestaña
