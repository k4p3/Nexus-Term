# app-settings Specification

## Purpose
Gestionar el almacenamiento persistente y la aplicación en caliente de las preferencias del usuario en NexusTerm, abarcando la internacionalización y selección de idioma, la apariencia visual del emulador de terminal (fuentes Nerd Font, tamaños, cursor y temas de color ANSI), la shell local predeterminada y la seguridad de la bóveda cifrada.

## Requirements

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

### Requirement: Ajustes de Apariencia de la Terminal
El sistema SHALL permitir configurar la familia tipográfica, tamaño de fuente, altura de línea, estilo de cursor (block, bar, underline), parpadeo del cursor, densidad de interfaz (cómoda o compacta) y tema de color unificado tanto para la terminal como para la interfaz gráfica completa, la cual MUST derivar todos sus colores de tokens de tema sin valores de color fijos en los componentes.

#### Scenario: Cambio de estilo y tamaño de fuente
- **WHEN** el usuario selecciona una nueva fuente o incrementa el tamaño de letra en la configuración
- **THEN** el sistema actualiza las opciones de terminal en el almacén de configuración

#### Scenario: Selección de tema de color predefinido
- **WHEN** el usuario selecciona un tema de color (como Dracula, Nord, Catppuccin o Nexus Paper)
- **THEN** el sistema asigna la paleta ANSI a la terminal xterm.js e inyecta en el DOM todos los tokens de superficie, texto, bordes, acento y colores semánticos de toda la interfaz

#### Scenario: Adaptación de tema personalizado importado
- **WHEN** el usuario importa y activa un tema personalizado en formato JSON
- **THEN** el sistema deriva una paleta de interfaz armónica, incluido su modo claro u oscuro por luminancia, y la aplica de forma reactiva en toda la ventana

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

### Requirement: Modo de Apariencia Claro, Oscuro y del Sistema
El sistema SHALL ofrecer temas de interfaz de modo claro y oscuro, y MUST permitir seguir la preferencia del sistema operativo (`prefers-color-scheme`) eligiendo un tema claro y uno oscuro asociados.

#### Scenario: Seguir al sistema
- **WHEN** el usuario activa "Seguir al sistema" y el sistema operativo cambia de modo
- **THEN** el sistema aplica el tema asociado al nuevo modo sin reiniciar y actualiza `color-scheme` del documento

#### Scenario: Legibilidad garantizada
- **WHEN** se define un tema integrado
- **THEN** el texto principal sobre el fondo y el texto sobre el acento MUST cumplir un contraste mínimo de 4.5:1

### Requirement: Persistencia de Temas Personalizados
El sistema SHALL persistir los temas personalizados importados en la base de datos local y MUST restaurarlos al iniciar, manteniendo compatibilidad con configuraciones anteriores que no contengan este campo.

#### Scenario: Tema personalizado tras reinicio
- **WHEN** el usuario importa un tema personalizado, lo activa y reinicia la aplicación
- **THEN** el sistema carga el tema personalizado y lo aplica a la terminal y a toda la interfaz

#### Scenario: Configuración anterior sin temas personalizados
- **WHEN** se carga una configuración guardada sin el campo de temas personalizados
- **THEN** el sistema utiliza una lista vacía y no produce errores
