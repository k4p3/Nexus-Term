# Spec Delta: app-settings

## MODIFIED Requirements

### Requirement: Almacenamiento Persistente de Preferencias
El sistema SHALL persistir las opciones de configuración del usuario en la base de datos local y MUST cargar valores predeterminados válidos si no existen preferencias previas, incluyendo el límite de transferencias concurrentes de SFTP.

#### Scenario: Carga inicial de preferencias predeterminadas
- **WHEN** la aplicación inicia sin configuración previa registrada
- **THEN** el sistema inicializa las preferencias con valores predeterminados (fuente Nerd Font, tamaño 13, cursor block, tema Tokyo Night, shell del sistema y 2 transferencias SFTP concurrentes) y permite su consulta inmediata

#### Scenario: Guardado y actualización de configuración
- **WHEN** el usuario modifica uno o varios parámetros en el panel de configuración y los guarda
- **THEN** el sistema persiste los cambios en la base de datos local y emite una notificación de actualización a los componentes visuales

#### Scenario: Configuración de transferencias concurrentes de SFTP
- **WHEN** el usuario modifica el valor de transferencias concurrentes en la sección de configuración (entre 1 y 5)
- **THEN** el sistema guarda el nuevo valor en la base de datos y el explorador SFTP ajusta dinámicamente el tamaño de su pool de trabajadores
