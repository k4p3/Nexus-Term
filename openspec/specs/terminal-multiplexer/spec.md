# terminal-multiplexer Specification

## Purpose
Proporciona el motor de emulación de terminal acelerado por GPU para sesiones SSH y terminales locales del sistema, con verificación TOFU de huellas de servidor y soporte de pestañas y paneles divididos dinámicos.

## Requirements

### Requirement: Sesiones Interactivas SSH y Shell Local
El sistema SHALL permitir abrir tanto sesiones SSH remotas como terminales de shell local del sistema operativo dentro de la misma interfaz.

#### Scenario: Apertura de sesión SSH remota
- **WHEN** el usuario selecciona un host configurado y solicita conectarse
- **THEN** el sistema establece la conexión SSH autenticada, solicita un PTY remoto y renderiza la sesión interactiva en la pestaña activa

#### Scenario: Apertura de terminal local
- **WHEN** el usuario solicita abrir una terminal local
- **THEN** el sistema lanza el shell predeterminado del usuario (como Zsh o Bash) en un PTY local conectado a la pestaña activa

### Requirement: Verificación de Huella de Servidor (TOFU)
El sistema MUST verificar la llave pública del servidor SSH contra el registro local de hosts conocidos antes de enviar credenciales de autenticación.

#### Scenario: Conexión a un servidor con huella desconocida
- **WHEN** el usuario se conecta por primera vez a un servidor cuya huella pública no está registrada
- **THEN** el sistema pausa la conexión, muestra el tipo de llave y su huella (fingerprint) y solicita confirmación explícita antes de confiar y continuar

#### Scenario: Detección de cambio de huella en un servidor conocido
- **WHEN** el servidor presenta una llave pública diferente a la registrada previamente para ese host y puerto
- **THEN** el sistema MUST abortar la autenticación inmediatamente y mostrar una alerta de seguridad advirtiendo un posible ataque Man-in-the-Middle

### Requirement: Pestañas y Paneles Divididos (Split Panes)
El sistema SHALL permitir gestionar múltiples sesiones simultáneas en pestañas y dividir cualquier pestaña horizontal o verticalmente ajustando automáticamente las dimensiones (`cols` y `rows`) de cada PTY.

#### Scenario: División de panel y redimensionado de terminal
- **WHEN** el usuario divide una pestaña activa en dos paneles o redimensiona la ventana
- **THEN** cada instancia de terminal recalcula sus filas y columnas y notifica el nuevo tamaño al PTY remoto o local sin corromper la salida en pantalla

### Requirement: Aplicación Dinámica de Preferencias en Paneles Activos
Las instancias activas de terminal MUST reaccionar en caliente a los cambios en la configuración de apariencia (fuente, tamaño, cursor y paleta de colores) aplicando las nuevas opciones y recalculando el ajuste de dimensiones sin interrumpir la conexión de red o proceso en curso.

#### Scenario: Cambio en caliente de tema y tamaño de fuente
- **WHEN** el usuario modifica el tema de color o el tamaño de letra en la configuración
- **THEN** todas las terminales abiertas actualizan su tema, fuente y dimensiones ajustadas inmediatamente sin cerrar ni reiniciar sus sesiones

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
