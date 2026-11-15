# host-inventory Specification

## Purpose
Proporciona la gestión jerárquica de carpetas, servidores SSH, etiquetas de clasificación e identidades de autenticación reutilizables con soporte de paleta de búsqueda rápida (Ctrl+K).

## Requirements

### Requirement: Organización Jerárquica en Carpetas
El sistema SHALL permitir organizar los servidores en carpetas y subcarpetas con nombre, icono y orden personalizado.

#### Scenario: Creación de carpeta y asignación de host
- **WHEN** el usuario crea una carpeta y asigna un host dentro de ella
- **THEN** el árbol lateral muestra el host agrupado bajo dicha carpeta y conserva la estructura tras reiniciar la aplicación

#### Scenario: Eliminación de carpeta con servidores asociados
- **WHEN** el usuario elimina una carpeta que contiene hosts
- **THEN** el sistema mueve los hosts a la raíz o solicita confirmación explícita sin dejar registros huérfanos

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

### Requirement: Gestión Completa de Hosts y Etiquetas
El sistema SHALL permitir registrar servidores especificando alias, dirección (hostname/IP), puerto SSH, carpeta, identidad vinculada y etiquetas (tags) de clasificación.

#### Scenario: Registro y edición de un servidor SSH
- **WHEN** el usuario guarda un host con dirección válida, puerto e identidad
- **THEN** el host queda disponible inmediatamente en la barra lateral y en el buscador rápido

### Requirement: Búsqueda Rápida de Conexiones
El sistema SHALL ofrecer una paleta de búsqueda rápida invocable por teclado para filtrar y abrir conexiones por alias, dirección IP, carpeta o etiqueta.

#### Scenario: Apertura de conexión desde el buscador rápido
- **WHEN** el usuario invoca el buscador rápido (`Ctrl+K`), escribe parte del nombre o etiqueta de un servidor y presiona `Enter`
- **THEN** el sistema abre inmediatamente una nueva pestaña de terminal conectada a dicho servidor
