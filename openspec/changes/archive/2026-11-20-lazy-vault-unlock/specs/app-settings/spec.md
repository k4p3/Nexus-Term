## ADDED Requirements

### Requirement: Ajustes de Bloqueo de la Bóveda
El sistema SHALL permitir configurar si se pide la contraseña maestra al iniciar (`ask_password_on_startup`, desactivado por defecto), si el auto-bloqueo por inactividad está activo (`auto_lock_enabled`) y su duración en minutos (`auto_lock_minutes`, 10 por defecto, mínimo 1), persistiéndolos con el resto de preferencias.

#### Scenario: Valores predeterminados
- **WHEN** la aplicación inicia sin configuración previa
- **THEN** `ask_password_on_startup` es falso, `auto_lock_enabled` es verdadero y `auto_lock_minutes` es 10

#### Scenario: Modificación de la duración del auto-bloqueo
- **WHEN** el usuario cambia `auto_lock_minutes` a un valor válido y guarda
- **THEN** el sistema persiste el valor AND aplica el nuevo temporizador sin reiniciar la aplicación

#### Scenario: Valor de duración inválido
- **WHEN** el usuario introduce una duración menor que 1 minuto
- **THEN** el sistema rechaza el valor y conserva el anterior
