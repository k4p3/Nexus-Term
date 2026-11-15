# app-settings Specification

## Purpose
Gestionar el almacenamiento persistente y la aplicación en caliente de las preferencias del usuario en NexusTerm, abarcando la internacionalización y selección de idioma, la apariencia visual del emulador de terminal (fuentes Nerd Font, tamaños, cursor y temas de color ANSI), la shell local predeterminada y la seguridad de la bóveda cifrada.

## Requirements

### Requirement: Almacenamiento Persistente de Preferencias
El sistema SHALL persistir las opciones de configuración del usuario en la base de datos local y MUST cargar valores predeterminados válidos si no existen preferencias previas.

#### Scenario: Carga inicial de preferencias predeterminadas
- **WHEN** la aplicación inicia sin configuración previa registrada
- **THEN** el sistema inicializa las preferencias con valores predeterminados (fuente Nerd Font, tamaño 13, cursor block, tema Tokyo Night y shell del sistema) y permite su consulta inmediata

#### Scenario: Guardado y actualización de configuración
- **WHEN** el usuario modifica uno o varios parámetros en el panel de configuración y los guarda
- **THEN** el sistema persiste los cambios en la base de datos local y emite una notificación de actualización a los componentes visuales

### Requirement: Ajustes de Apariencia de la Terminal
El sistema SHALL permitir configurar la familia tipográfica, tamaño de fuente, altura de línea, estilo de cursor (block, bar, underline), parpadeo del cursor y tema de color de la terminal.

#### Scenario: Cambio de estilo y tamaño de fuente
- **WHEN** el usuario selecciona una nueva fuente o incrementa el tamaño de letra en la configuración
- **THEN** el sistema actualiza las opciones de terminal en el almacén de configuración

#### Scenario: Selección de tema de color predefinido
- **WHEN** el usuario selecciona un tema de color (como Dracula o Catppuccin)
- **THEN** el sistema asigna la paleta de 16 colores ANSI y colores de fondo/texto correspondientes a la configuración activa

### Requirement: Internacionalización e Idioma de la Aplicación
El sistema SHALL permitir al usuario seleccionar el idioma de la interfaz gráfica (inglés y español preinstalados) y MUST cargar dinámicamente traducciones en formato JSON estándar con fallback automático a inglés.

#### Scenario: Cambio de idioma en caliente
- **WHEN** el usuario selecciona "Español" o "English" en las preferencias de idioma
- **THEN** la interfaz actualiza reactivamente todos los textos visibles sin requerir recargar la aplicación ni reiniciar procesos de backend

#### Scenario: Carga de idioma comunitario personalizado
- **WHEN** el usuario proporciona un archivo JSON con traducciones válidas para un nuevo idioma
- **THEN** el sistema registra el nuevo idioma en el catálogo local y permite su activación inmediata con fallback a inglés para claves no traducidas

### Requirement: Opciones de Seguridad y Shell Local
El sistema SHALL permitir configurar la ruta del shell predeterminado para nuevas sesiones locales y MUST proporcionar una interfaz para rotar la contraseña maestra de la bóveda.

#### Scenario: Actualización de shell predeterminado
- **WHEN** el usuario define `/bin/zsh` como su shell preferido
- **THEN** las nuevas pestañas locales invocan dicho binario en lugar del shell por defecto del sistema

#### Scenario: Rotación de contraseña maestra desde configuración
- **WHEN** el usuario introduce su contraseña maestra actual correcta y una nueva contraseña en la sección de seguridad
- **THEN** el sistema re-envuelve la clave de la bóveda con la nueva contraseña y mantiene todos los secretos cifrados accesibles
