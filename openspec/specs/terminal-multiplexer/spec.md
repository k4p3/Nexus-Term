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
