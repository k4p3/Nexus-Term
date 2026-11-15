# Vault Security Specification

## ADDED Requirements

### Requirement: Inicialización de Bóveda con Contraseña Maestra
El sistema SHALL permitir inicializar una nueva bóveda local solicitando una contraseña maestra, derivando una clave de envoltura (`MasterKey`) y generando una clave aleatoria de cifrado de datos (`VaultKey`) almacenada de forma cifrada.

#### Scenario: Creación exitosa de nueva bóveda
- **WHEN** el usuario inicia la aplicación por primera vez y define una contraseña maestra válida
- **THEN** el sistema genera una sal criptográfica aleatoria, deriva la `MasterKey`, cifra la `VaultKey` y persiste los metadatos en la base de datos local dejando la bóveda desbloqueada

#### Scenario: Intento de inicialización sobre una bóveda ya existente
- **WHEN** se solicita inicializar una bóveda cuando ya existe un registro de metadatos configurado
- **THEN** el sistema MUST rechazar la operación con un error explícito sin sobrescribir las claves existentes

### Requirement: Desbloqueo y Bloqueo Seguro en Memoria
El sistema SHALL requerir el desbloqueo de la bóveda con la contraseña maestra antes de acceder a secretos y MUST limpiar de la memoria RAM todas las claves en texto plano al bloquear la sesión.

#### Scenario: Desbloqueo con contraseña maestra correcta
- **WHEN** el usuario introduce la contraseña maestra correcta en una bóveda bloqueada
- **THEN** el sistema verifica la autenticidad de la clave envuelta, carga la `VaultKey` en memoria protegida y habilita el acceso a las identidades y sesiones

#### Scenario: Fallo de desbloqueo por contraseña incorrecta
- **WHEN** el usuario introduce una contraseña maestra incorrecta
- **THEN** la verificación de autenticidad falla, la bóveda permanece bloqueada y no se expone ningún secreto

#### Scenario: Bloqueo manual o al cerrar la aplicación
- **WHEN** el usuario bloquea la bóveda manualmente o cierra la aplicación
- **THEN** el sistema MUST sobrescribir con ceros la `VaultKey` en memoria RAM y revocar el acceso a los secretos hasta un nuevo desbloqueo

### Requirement: Cifrado Autenticado por Registro
El sistema MUST cifrar individualmente cada secreto almacenado (contraseñas, llaves privadas SSH, passphrases y notas) con un vector de inicialización (nonce) único por operación de escritura.

#### Scenario: Almacenamiento de una credencial sensible
- **WHEN** el usuario guarda o actualiza una identidad con contraseña o llave privada
- **THEN** el sistema cifra el campo sensible con un nonce aleatorio único antes de escribirlo en el almacenamiento persistente

### Requirement: Cambio de Contraseña Maestra sin Recifrado Masivo
El sistema SHALL permitir actualizar la contraseña maestra re-envolviendo únicamente la `VaultKey` con una nueva clave derivada y nueva sal, sin alterar los registros individuales ya cifrados.

#### Scenario: Rotación de contraseña maestra exitosa
- **WHEN** el usuario proporciona su contraseña maestra actual válida y una nueva contraseña maestra
- **THEN** el sistema vuelve a cifrar la `VaultKey` con la nueva clave derivada y mantiene intactos todos los secretos almacenados
