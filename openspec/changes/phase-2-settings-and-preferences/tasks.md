# Tasks

## 1. Backend de Preferencias y Migración SQLite (`app-settings`)

- [x] 1.1 Agregar la tabla `app_settings` a las migraciones SQLite en `src-tauri/src/vault/db.rs`, crear el módulo `src-tauri/src/settings.rs` con valores predeterminados de `AppSettings` y los comandos Tauri `get_app_settings` y `save_app_settings`, verificando con `cargo test`.

## 2. Temas de Color, Internacionalización y Almacén de Estado Frontend

- [x] 2.1 Definir las paletas de colores en `src/types/themes.ts` (*Tokyo Night*, *One Dark*, *Dracula*, *Catppuccin*, *Nord*, *KDE Breeze Dark*) y crear `src/services/settings.service.ts`.
- [x] 2.2 Implementar el store `src/stores/settings.store.ts` con carga de configuración al iniciar la aplicación y métodos reactivos para actualizar preferencias.
- [x] 2.3 Configurar `vue-i18n` en `src/locales/index.ts`, crear los diccionarios base modulares `src/locales/en.json` y `src/locales/es.json` con soporte para carga dinámica de idiomas comunitarios.

## 3. Modal de Preferencias, Traducción de Interfaz y Aplicación en Caliente

- [x] 3.1 Construir el componente `src/components/settings/SettingsModal.vue` con pestañas de *General e Idioma* (selector de idioma y cargador de JSON comunitario), *Apariencia de Terminal* (fuentes, tamaño, cursor, temas con importador de esquemas), *Shell Local* y *Seguridad de Bóveda*.
- [x] 3.2 Integrar el botón de ajustes en el encabezado de `src/App.vue` y en la paleta `QuickConnectModal.vue` (`Ctrl+K`), y conectar `src/components/terminal/TerminalPane.vue` para aplicar en caliente los cambios de fuente y tema visual sin reiniciar sesiones.
- [x] 3.3 Reemplazar los textos estáticos en los componentes de la aplicación (`VaultUnlockScreen`, `HostTreeSidebar`, `Modals`, `TerminalWorkspace`) con claves reactivas de `$t()` en inglés y español.

## Workflow follow-up

- Validar especificaciones con `openspec validate --all --strict`.
