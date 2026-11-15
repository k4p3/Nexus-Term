# Spec Delta: host-inventory

## ADDED Requirements

### Requirement: Importación Inteligente de SSH Config y Known Hosts
El sistema SHALL permitir detectar, previsualizar e importar servidores, identidades y claves públicas de servidores confiables desde archivos locales OpenSSH (`~/.ssh/config` y `known_hosts`).

#### Scenario: Detección y vista previa de servidores en ~/.ssh/config
- **WHEN** el usuario abre el modal de importación de configuración SSH
- **THEN** el sistema analiza automáticamente `~/.ssh/config` y lista los bloques `Host` encontrados con su dirección, puerto, usuario y clave asociada

#### Scenario: Importación selectiva de hosts e identidades
- **WHEN** el usuario selecciona uno o varios hosts detectados y confirma la importación
- **THEN** el sistema registra dichos servidores en la bóveda, agrupándolos opcionalmente en una carpeta designada y creando las identidades correspondientes

#### Scenario: Importación de claves de servidores confiables desde known_hosts
- **WHEN** el usuario opta por sincronizar las claves de `~/.ssh/known_hosts`
- **THEN** el sistema precarga las huellas digitales y claves en la tabla `known_hosts` de la bóveda para evitar advertencias TOFU en servidores ya validados

#### Scenario: Detección y manejo de servidores duplicados
- **WHEN** un servidor analizado coincide en hostname y puerto con un registro existente en la bóveda
- **THEN** el sistema lo identifica como duplicado y permite al usuario omitirlo o actualizarlo
