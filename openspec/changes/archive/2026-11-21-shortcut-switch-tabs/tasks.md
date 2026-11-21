## 1. Implementación

- [x] 1.1 Añadir `activateAdjacentTab(delta)` en `src/stores/sessions.store.ts`.
- [x] 1.2 Registrar `app.nextTab`, `app.nextTabAlt`, `app.prevTab`, `app.prevTabAlt` en `src/utils/shortcuts.ts`.
- [x] 1.3 Manejar los cuatro ids en `handleGlobalKeyDown` de `src/App.vue`.
- [x] 1.4 Añadir las claves `shortcuts.app.*Tab*` en `es.json` y `en.json`.
- [x] 1.5 Documentar los atajos en `README.md`, `README.es.md`, `docs/FEATURES_MANUAL.md`, `site/en/shortcuts.html` y `site/es/atajos.html`, y registrar las variantes alternativas en `DOCUMENTED_AS`.

## 2. Pruebas

- [x] 2.1 Pruebas del store: siguiente, anterior, ciclo en los extremos y sin efecto con 0 o 1 pestañas.
- [x] 2.2 Pruebas del registro: los combos resuelven a los ids correctos y no hay conflictos.
- [x] 2.3 Ejecutar `pnpm test`, `vue-tsc --noEmit` y `vite build` con cero errores.

## 3. Cierre

- [x] 3.1 Ejecutar `openspec validate` y archivar el cambio.
