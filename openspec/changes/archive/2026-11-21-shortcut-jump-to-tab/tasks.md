## 1. Implementación

- [x] 1.1 Añadir `activateTabByIndex(index)` en `src/stores/sessions.store.ts`.
- [x] 1.2 Registrar `app.goToTab1..9` en `src/utils/shortcuts.ts` y ampliar `CODE_LABELS` con `Digit1..9`.
- [x] 1.3 Manejar los nueve ids en `handleGlobalKeyDown` de `src/App.vue` (`Alt+9` = última pestaña).
- [x] 1.4 Añadir las claves `shortcuts.app.goToTab1..9` en `es.json` y `en.json`.
- [x] 1.5 Documentar `Alt+1..9` en `README.md`, `README.es.md`, `docs/FEATURES_MANUAL.md`, `site/en/shortcuts.html` y `site/es/atajos.html`, y aceptar esa forma en `shortcuts.docs.test.ts` y `site.docs.test.ts`.

## 2. Pruebas

- [x] 2.1 Pruebas del store: salto a una posición válida, posición inexistente sin efecto y última pestaña.
- [x] 2.2 Pruebas del registro: `Alt+1..9` resuelven a su id, no hay conflictos y `Alt+Flechas` sigue funcionando.
- [x] 2.3 Ejecutar `pnpm test`, `vue-tsc --noEmit` y `vite build` con cero errores.

## 3. Cierre

- [x] 3.1 Ejecutar `openspec validate` y archivar el cambio.
