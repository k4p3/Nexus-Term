## MODIFIED Requirements

### Requirement: Pestañas y Paneles Divididos (Split Panes)
El sistema SHALL permitir gestionar múltiples sesiones simultáneas en pestañas y dividir cualquier panel hacia la izquierda, derecha, arriba o abajo ajustando automáticamente las dimensiones (`cols` y `rows`) de cada PTY, y MUST preservar activas e intactas las sesiones y la salida en pantalla de todos los paneles existentes al dividir, acoplar o cerrar paneles.

#### Scenario: División de panel y redimensionado de terminal
- **WHEN** el usuario divide una pestaña activa en dos paneles o redimensiona la ventana
- **THEN** cada instancia de terminal recalcula sus filas y columnas y notifica el nuevo tamaño al PTY remoto o local sin corromper la salida en pantalla

#### Scenario: División de panel en cualquier dirección sin reiniciar sesiones existentes
- **WHEN** el usuario divide un panel activo hacia la derecha, izquierda, abajo o arriba en una pestaña que contiene uno o más paneles con procesos o salida en pantalla
- **THEN** el sistema inserta el nuevo panel en la posición solicitada, conserva sin interrupción las conexiones, procesos PTY/SSH y el buffer visual de todos los paneles previos de la pestaña, y recalcula las filas y columnas de cada panel

#### Scenario: Cierre de un panel dividido preservando los demás paneles
- **WHEN** el usuario cierra un panel dentro de una pestaña con dos o más paneles abiertos (incluso si el panel cerrado mostraba un error de conexión o era el panel activo)
- **THEN** el sistema cierra únicamente la sesión del panel eliminado, reasigna el foco a un panel sobreviviente si el cerrado estaba activo, y mantiene intactas las sesiones y salidas en pantalla del resto de paneles de la pestaña

#### Scenario: Acoplamiento de pestaña en panel dividido sin reiniciar sesiones
- **WHEN** el usuario acopla otra pestaña abierta dentro de un panel existente
- **THEN** los paneles de la pestaña destino conservan sus sesiones activas y su salida en pantalla sin reiniciarse mientras se ajusta la nueva distribución

#### Scenario: Ajuste interactivo de proporciones entre paneles
- **WHEN** el usuario arrastra el divisor entre dos paneles divididos
- **THEN** el sistema actualiza la proporción de espacio de ambos lados y cada instancia de terminal afectada recalcula sus filas y columnas sin reconectar la sesión
