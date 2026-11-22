## Why

Con `Ctrl+Tab` se pasa de una pestaña a la siguiente, pero con muchas conexiones abiertas saltar directamente a una concreta sigue exigiendo el ratón o varias pulsaciones. `Alt+1..9` es la convención de navegadores y emuladores de terminal.

## What Changes

- `Alt+1` … `Alt+8`: activa la pestaña en esa posición.
- `Alt+9`: activa la última pestaña (convención de los navegadores), sea cual sea su número.
- Si la posición no existe, no hace nada.
- Se registran en `src/utils/shortcuts.ts` (aparecen en la hoja de atajos) y se documentan en READMEs, manual y sitio.
- Sin cambios en Rust ni dependencias nuevas (no aplica verificación de licencias).

## Capabilities

### Modified Capabilities
- `keyboard-shortcuts`: se añaden los atajos de salto directo a pestaña.

## Impact

- `src/utils/shortcuts.ts` y su prueba, `src/stores/sessions.store.ts` (acción `activateTabByIndex`) y su prueba, `src/App.vue`, `src/locales/{es,en}.json`, `README.md`, `README.es.md`, `docs/FEATURES_MANUAL.md`, `site/en/shortcuts.html`, `site/es/atajos.html`, `src/utils/shortcuts.docs.test.ts`, `src/utils/site.docs.test.ts`.
