# Tasks

## 1. Backend de Preferencias y Migración SQLite (`app-settings`)

- [ ] 1.1 Agregar la tabla `app_settings` a las migraciones SQLite en `src-tauri/src/vault/db.rs`, crear el módulo `src-tauri/src/settings.rs` con valores predeterminados de `AppSettings` y los comandos Tauri `get_app_settings` y `save_app_settings`, verificando con `cargo test`.

## 2. Temas de Color y Almacén de Estado Frontend

- [ ] 2.1 Definir las paletas de colores en `src/types/themes.ts` (*Tokyo Night*, *One Dark*, *Dracula*, *Catppuccin*, *Nord*, *KDE Breeze Dark*) y crear `src/services/settings.service.ts`.
- [ ] 2.2 Implementar el store `src/stores/settings.store.ts` con carga de configuración al iniciar la aplicación y métodos reactivos para actualizar preferencias.

## 3. Modal de Preferencias y Aplicación en Caliente en Terminales

- [ ] 3.1 Construir el componente `src/components/settings/SettingsModal.vue` con pestañas de *Apariencia de Terminal* (fuentes, tamaño, cursor, paletas de color con previsualización), *Shell Local* y *Seguridad de Bóveda* (cambio de contraseña maestra).
- [ ] 3.2 Integrar el botón de ajustes en el encabezado de `src/App.vue` y en la paleta `QuickConnectModal.vue` (`Ctrl+K`), y conectar `src/components/terminal/TerminalPane.vue` para aplicar en caliente los cambios de fuente y tema visual sin reiniciar sesiones.

## Workflow follow-up

- Validar especificaciones con `openspec validate --all --strict`.
