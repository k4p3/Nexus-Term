## 1. Frontend

- [x] 1.1 `ui.store.ts`: registro de insertadores por panel (`registerPaneInserter`, `unregisterPaneInserter`, `insertIntoPane`) con pruebas.
- [x] 1.2 `TerminalPane.vue`: registrar y retirar el insertador (reutiliza `insertSuggestion(text, false)`) y devolver el foco.
- [x] 1.3 `App.vue#handleInsertCommand`: insertar vía `insertIntoPane` en el panel activo; aviso si no hay terminal.
- [x] 1.4 `SnippetDrawer.vue` y `QuickConnectModal.vue`: dejar de añadir `"\n"`; ajustar pistas (`insertHint`) en `es.json`/`en.json`.
- [x] 1.5 Pruebas: los emisores no envían `\n`, `insertIntoPane` devuelve `false` sin panel, y el flujo del aviso de pegado.

## 2. Documentación

- [x] 2.1 `docs/FEATURES_MANUAL.md` (§4.2), `docs/MANUAL_TEST_CHECKLIST.md`, `README.md`, `README.es.md`, `CHANGELOG.md` (como *Changed*) y guías del sitio.

## 3. Verificación

- [x] 3.1 `pnpm test`, `vue-tsc --noEmit` y `vite build` con cero errores.

## 4. Cierre

- [x] 4.1 `openspec validate` y archivar el cambio.
