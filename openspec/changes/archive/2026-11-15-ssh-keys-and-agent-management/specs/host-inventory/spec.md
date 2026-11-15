# Spec Delta: host-inventory

## MODIFIED Requirements

### Requirement: Gestión de Identidades Reutilizables
El sistema SHALL permitir crear, editar y eliminar identidades de autenticación (usuario + contraseña, llave privada SSH con passphrase opcional, o agente SSH del sistema) que pueden vincularse a uno o varios hosts, persistiendo la clave pública correspondiente y soportando importación de archivos de clave.

#### Scenario: Vinculación de una identidad a múltiples servidores
- **WHEN** el usuario selecciona una identidad guardada al configurar dos servidores distintos
- **THEN** ambos servidores utilizan dicha credencial al iniciar sesión sin duplicar el secreto en la bóveda

#### Scenario: Persistencia y visualización de clave pública OpenSSH
- **WHEN** el usuario genera o guarda una identidad con llave privada SSH
- **THEN** el sistema deriva y mantiene visible la clave pública en formato OpenSSH con opción de copiado directo al portapapeles para agregarla a `~/.ssh/authorized_keys`

#### Scenario: Importación de archivo de clave privada
- **WHEN** el usuario carga un archivo de clave privada (`id_ed25519`, `id_rsa`, `.pem`) desde el sistema de archivos
- **THEN** el sistema valida el formato de la clave, extrae su clave pública y solicita la frase de paso (passphrase) si el archivo se encuentra protegido

#### Scenario: Autenticación delegada al agente SSH del sistema
- **WHEN** el usuario conecta a un host vinculado a una identidad configurada con autenticación por agente
- **THEN** el sistema delega el protocolo de autenticación al socket activo del agente SSH local (`SSH_AUTH_SOCK` o pipe de Windows)
