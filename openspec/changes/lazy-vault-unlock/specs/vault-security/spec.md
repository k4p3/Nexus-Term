## MODIFIED Requirements

### Requirement: Desbloqueo y Bloqueo Seguro en Memoria
El sistema SHALL requerir el desbloqueo de la bóveda con la contraseña maestra antes de acceder a secretos o iniciar conexiones que usen credenciales almacenadas, y MUST limpiar de la memoria RAM todas las claves en texto plano al bloquear la bóveda. El bloqueo SHALL NOT cerrar las sesiones ya establecidas.

#### Scenario: Desbloqueo con contraseña maestra correcta
- **WHEN** el usuario introduce la contraseña maestra correcta en una bóveda bloqueada
- **THEN** el sistema verifica la autenticidad de la clave envuelta, carga la `VaultKey` en memoria protegida y habilita el acceso a las identidades y sesiones

#### Scenario: Fallo de desbloqueo por contraseña incorrecta
- **WHEN** el usuario introduce una contraseña maestra incorrecta
- **THEN** la verificación de autenticidad falla, la bóveda permanece bloqueada y no se expone ningún secreto

#### Scenario: Bloqueo manual o al cerrar la aplicación
- **WHEN** el usuario bloquea la bóveda manualmente o cierra la aplicación
- **THEN** el sistema MUST sobrescribir con ceros la `VaultKey` en memoria RAM y revocar el acceso a los secretos hasta un nuevo desbloqueo

#### Scenario: Bloqueo con sesiones abiertas
- **WHEN** la bóveda se bloquea mientras existen sesiones locales o remotas abiertas
- **THEN** el sistema MUST mantener esas sesiones activas AND MUST rechazar la apertura de nuevas conexiones con credenciales hasta un nuevo desbloqueo

## ADDED Requirements

### Requirement: Arranque sin Desbloqueo y Desbloqueo Bajo Demanda
El sistema SHALL iniciar mostrando una terminal local sin solicitar la contraseña maestra, y MUST solicitarla únicamente cuando el usuario realice una acción que requiera credenciales almacenadas (abrir un host, usar identidades, SFTP, túneles con host guardado, RDP/VNC, importar `ssh_config` o guardar un host).

#### Scenario: Arranque con la bóveda bloqueada
- **WHEN** la aplicación se inicia y `ask_password_on_startup` está desactivado
- **THEN** el sistema abre una terminal local con la shell configurada sin mostrar la pantalla de desbloqueo

#### Scenario: Acción que requiere credenciales con la bóveda bloqueada
- **WHEN** el usuario intenta abrir una conexión a un host guardado con la bóveda bloqueada
- **THEN** el sistema muestra el modal de desbloqueo AND tras un desbloqueo correcto continúa automáticamente con la acción solicitada

#### Scenario: Primer uso sin bóveda creada
- **WHEN** el usuario realiza una acción que requiere la bóveda y esta no está inicializada
- **THEN** el sistema muestra el modal en modo de creación de contraseña maestra con confirmación

#### Scenario: Pedir contraseña al iniciar
- **WHEN** la aplicación se inicia y `ask_password_on_startup` está activado
- **THEN** el sistema MUST mostrar el desbloqueo antes de permitir el acceso al workspace, como en el comportamiento previo

### Requirement: Error de Bóveda Bloqueada Identificable
El sistema MUST devolver al frontend un error de bóveda bloqueada con un código estable distinguible de otros errores, en todo comando que requiera la clave de la bóveda.

#### Scenario: Comando con credenciales invocado sin clave
- **WHEN** el frontend invoca un comando que requiere la `VaultKey` y la bóveda está bloqueada
- **THEN** el comando falla con el error identificable de bóveda bloqueada AND el frontend lo usa para solicitar el desbloqueo y reintentar

### Requirement: Auto-bloqueo por Inactividad
El sistema SHALL bloquear la bóveda automáticamente tras un periodo configurable de inactividad del usuario cuando la opción esté activada. La inactividad MUST medirse por entrada del usuario (teclado, ratón o foco) y no por la salida de las terminales.

#### Scenario: Bloqueo tras inactividad
- **WHEN** `auto_lock_enabled` está activo y transcurren `auto_lock_minutes` sin entrada del usuario
- **THEN** el sistema bloquea la bóveda con la misma semántica que el bloqueo manual, conservando las sesiones abiertas

#### Scenario: Auto-bloqueo desactivado
- **WHEN** `auto_lock_enabled` está desactivado
- **THEN** el sistema MUST NOT bloquear la bóveda por inactividad

### Requirement: Restauración de Sesiones sin Bóveda
El sistema SHALL restaurar al arrancar las pestañas locales sin requerir la bóveda y MUST restaurar las pestañas remotas solo tras el desbloqueo, sin sobrescribir el layout guardado con un estado parcial.

#### Scenario: Layout mixto con bóveda bloqueada
- **WHEN** existe un layout guardado con pestañas locales y remotas y la aplicación arranca bloqueada
- **THEN** el sistema restaura las locales, conserva intacto el layout guardado AND ofrece restaurar las remotas tras el desbloqueo

#### Scenario: Oferta de restauración tras un desbloqueo bajo demanda
- **WHEN** el usuario desbloquea la bóveda bajo demanda y existe un layout guardado con hosts pendiente de restaurar
- **THEN** el sistema MUST mostrar la oferta de restauración como un aviso no modal que no bloquea la terminal ni apila un diálogo sobre el de la contraseña AND MUST conservar intacto el layout guardado mientras el usuario no responda
