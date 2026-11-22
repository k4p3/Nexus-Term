## Why

Abrir una terminal local solo es posible con el ratón (botón «+» de la barra de pestañas o la paleta). En una app pensada para navegación completa por teclado falta un atajo, y `Ctrl+Shift+T` es el estándar de facto en emuladores de terminal (GNOME Terminal, Konsole, Tabby).

## What Changes

- Nuevo atajo global `Ctrl+Shift+T` (`terminal.newLocal`) que abre una pestaña nueva con una terminal local.
- Se registra en el registro único `src/utils/shortcuts.ts`, por lo que aparece automáticamente en la hoja de atajos y en la paleta.
- Nueva clave i18n `shortcuts.terminal.newLocal` en `es.json` y `en.json`.
- Sin nuevas dependencias (no aplica verificación de licencias).

## Capabilities

### New Capabilities
<!-- Ninguna -->

### Modified Capabilities
- `keyboard-shortcuts`: se añade el atajo de nueva terminal local.

## Impact

- `src/utils/shortcuts.ts`, `src/utils/shortcuts.test.ts`
- `src/App.vue` (manejador global)
- `src/locales/es.json`, `src/locales/en.json`
- Sin cambios en el backend Rust.
