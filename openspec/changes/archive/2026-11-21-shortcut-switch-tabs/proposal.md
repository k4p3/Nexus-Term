## Why

Ya existen atajos para moverse entre paneles de una vista dividida (`Alt+Flechas`), pero no para cambiar entre pestañas de conexión: hay que usar el ratón. Para una navegación completa por teclado hace falta un atajo de pestaña siguiente/anterior.

## What Changes

- `Ctrl+Tab` / `Ctrl+Shift+Tab`: pestaña siguiente / anterior (navegación cíclica).
- `Ctrl+PageDown` / `Ctrl+PageUp`: alternativas equivalentes, por si el entorno (WebKitGTK u otro) captura `Ctrl+Tab`.
- Se registran en `src/utils/shortcuts.ts` (aparecen solas en la hoja de atajos) y se documentan en READMEs, manual y sitio.
- Sin cambios en Rust ni dependencias nuevas (no aplica verificación de licencias).

## Capabilities

### Modified Capabilities
- `keyboard-shortcuts`: se añaden los atajos de cambio de pestaña.

## Impact

- `src/utils/shortcuts.ts` y su prueba, `src/stores/sessions.store.ts` (acción `activateAdjacentTab`) y su prueba, `src/App.vue`, `src/locales/{es,en}.json`, `README.md`, `README.es.md`, `docs/FEATURES_MANUAL.md`, `site/en/shortcuts.html`, `site/es/atajos.html`.
