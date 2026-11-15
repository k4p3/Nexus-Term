# Proposal

## Why

Cada desarrollador y administrador de sistemas cuenta con preferencias distintas en su entorno de terminal (fuentes Nerd Font específicas como MesloLGS NF o Hack, tamaños de texto, temas de color de alto contraste, cursores y shells locales preferidas). Actualmente NexusTerm utiliza valores predeterminados fijos. Esta segunda fase introduce un sistema centralizado y persistente de configuración (`app-settings`) y un panel visual de preferencias que permite ajustar en caliente la apariencia de las terminales, la shell del sistema y los parámetros de seguridad de la bóveda sin reiniciar la aplicación.

## What Changes

- **Motor de Configuración Persistente (`app-settings`)**: Nueva tabla SQLite `settings` y comandos Tauri (`get_settings`, `update_settings`, `reset_settings`) con valores predeterminados sensibles y sincronización reactiva en el frontend.
- **Sistema de Internacionalización (`i18n`)**: Integración de `vue-i18n` con estructura modular en JSON (`en.json`, `es.json`), permitiendo alternar idioma entre inglés y español al instante, con fallback seguro a inglés y posibilidad de importar o añadir traducciones comunitarias fácilmente.
- **Panel Visual de Configuración (`SettingsModal.vue`)**: Modal accesible desde un botón de engranaje en la barra superior o paleta `Ctrl+K`, organizado en pestañas: *General e Idioma*, *Apariencia de Terminal*, *Shell Local*, *Seguridad de Bóveda* y *Acerca de*.
- **Personalización de Terminal (`terminal-multiplexer`)**:
  - Selector de familia tipográfica con autocompletado de fuentes Nerd Font comunes.
  - Control de tamaño de fuente (`fontSize`), altura de línea (`lineHeight`) y espaciado.
  - Estilo de cursor (`block`, `bar`, `underline`) y parpadeo (`blink: true/false`).
  - Selector de temas de color predefinidos (*Tokyo Night*, *One Dark*, *Dracula*, *Catppuccin Macchiato*, *Nord*, *KDE Breeze Dark*) y soporte para importar esquemas JSON comunitarios.
  - Aplicación dinámica e inmediata de cambios en todas las terminales abiertas sin desconectar sesiones activas.
- **Gestión de Shell Local y Seguridad**:
  - Selección de shell local (`/bin/zsh`, `/bin/bash`, `/usr/bin/fish` o ruta personalizada).
  - Sección para rotación de contraseña maestra desde la UI y ajuste de temporizador de autobloqueo de la bóveda por inactividad.

## Capabilities

### New Capabilities
- `app-settings`: Almacenamiento, consulta, actualización y valores predeterminados de preferencias del usuario (apariencia de terminal, idioma de interfaz, shell local, seguridad y atajos).

### Modified Capabilities
- `terminal-multiplexer`: Los paneles de terminal `@xterm/xterm` deben reaccionar reactivamente y aplicar en caliente los cambios de fuente, tamaño, cursor y paleta de color recibidos desde el almacén de configuración.

## Impact

- **Backend (`src-tauri/`)**: Adición de la tabla `settings` a SQLite, módulo `settings` con comandos Tauri (`get_settings`, `update_settings`), y emisión de eventos de actualización hacia la UI.
- **Frontend (`src/`)**: Creación de `src/stores/settings.store.ts`, `src/services/settings.service.ts`, `src/components/settings/SettingsModal.vue`, paletas de colores en `src/types/theme.ts` y reactividad en `TerminalPane.vue`.
