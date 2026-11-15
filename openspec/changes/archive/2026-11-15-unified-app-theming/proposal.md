# Proposal: Unified App-Wide Theming

## Why

Actualmente, al cambiar el tema de color en las preferencias de NexusTerm (*Tokyo Night*, *One Dark*, *Dracula*, *Catppuccin Macchiato*, *Nord*, *KDE Breeze Dark* o temas personalizados importados), la paleta seleccionada solo afecta al buffer interno de `xterm.js`. El marco exterior de la aplicación (barra superior de título, explorador lateral de servidores, barra de pestañas, modales de conexión rápida, ajustes y bordes divisores) se mantiene estático en tonos `slate-950/900`. Esto genera una fractura visual y rompe la armonía estética del gestor de terminales.

Unificar la tematización a nivel de toda la interfaz gráfica (Full-App Theming) proporciona una experiencia de usuario inmersiva, profesional y coherente similar a emuladores y editores modernos como Warp, Zed y VS Code.

## What Changes

- **Tokens de Diseño Dinámicos (CSS Variables)**: Definición de variables CSS semánticas en `:root` (`--theme-bg-app`, `--theme-bg-surface`, `--theme-bg-header`, `--theme-bg-active`, `--theme-border`, `--theme-text-main`, `--theme-text-muted`, `--theme-accent`, `--theme-accent-hover`).
- **Paletas de Interfaz para Temas Predefinidos**: Cada tema predefinido en `PRESET_THEMES` contará con su especificación visual para la UI (fondos de barra lateral, bordes, cabeceras y acentos correspondientes).
- **Generación Automática para Temas Personalizados**: Los temas importados por el usuario mediante JSON derivarán automáticamente una paleta de UI coherente a partir de sus colores de fondo, texto y colores ANSI primarios.
- **Aplicación Reactiva en Caliente**: La tienda `settings.store.ts` inyectará inmediatamente los tokens al iniciar la aplicación y al seleccionar cualquier tema en tiempo real, sin requerir recargar ni reiniciar la ventana.
- **Refactorización de Componentes Clave**: Actualización de clases visuales en `App.vue`, `HostTreeSidebar.vue`, `TerminalWorkspace.vue`, `SplitPaneContainer.vue`, `SettingsModal.vue`, `QuickConnectModal.vue` y `SnippetDrawer.vue` para consumir los tokens de tema dinámicos.

## Capabilities

### New Capabilities
*(Ninguna nueva capacidad requerida; se amplía el comportamiento del sistema existente).*

### Modified Capabilities
- `app-settings`: Modificar el requerimiento de apariencia de terminal para exigir que la selección de tema actualice tanto la terminal `xterm.js` como la interfaz gráfica completa de la aplicación mediante tokens semánticos reactivos.

## Impact

- **Frontend**:
  - `src/types/themes.ts`: Extensión de la interfaz `TerminalTheme` para incluir `ui?: UiThemePalette`.
  - `src/stores/settings.store.ts`: Método `applyThemeToDom()` invocado en la carga y al actualizar `theme_id`.
  - `src/style.css`: Declaración de variables CSS base por defecto y utilidades de tema.
  - `src/components/**`: Transición de fondos y bordes estáticos `slate-*` hacia tokens dinámicos `--theme-*`.
- **Rendimiento**: Cambio instantáneo mediante variables CSS nativas sin recálculos pesados en JavaScript ni parpadeos en WebGL.
