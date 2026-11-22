## 1. Utilidades

- [x] 1.1 Crear `src/utils/line-buffer.ts` (`LineBuffer`) con edición, reinicio y marca `reliable`.
- [x] 1.2 Crear `src/utils/completion-candidates.ts` (`buildCandidates`) y refactorizar `HistoryPicker.vue` para usarla.

## 2. Componente y terminal

- [x] 2.1 Crear `src/components/terminal/AutocompletePopup.vue` (anclado al cursor, sin robar foco, máx. 8 filas).
- [x] 2.2 Cargarlo con `defineAsyncComponent` en `TerminalPane.vue`, alimentar `LineBuffer` desde `term.onData` y gestionar `↑`/`↓`/`Tab`/`Esc` en `attachCustomKeyEventHandler`.
- [x] 2.3 Implementar la aceptación (`\x15` + texto si es fiable; solo texto si no) sin añadir `\r`.
- [x] 2.4 Deshabilitar el popup en pantalla alterna y respetar `history_enabled`.

## 3. Atajo, textos y documentación

- [x] 3.1 Registrar `terminal.autocomplete` (`Ctrl+Space`) en `src/utils/shortcuts.ts` y ampliar la lista de permitidos de su prueba.
- [x] 3.2 Añadir las claves i18n en `es.json` y `en.json`.
- [x] 3.3 Documentar en `README.md`, `README.es.md`, `docs/FEATURES_MANUAL.md`, `site/en/{guide,shortcuts}.html`, `site/es/{guia,atajos}.html` y `CHANGELOG.md`.

## 4. Pruebas

- [x] 4.1 Pruebas de `LineBuffer`: imprimibles, borrado, Ctrl+U/Ctrl+W, reinicio con Enter/Ctrl+C, secuencias de escape, Tab, pegado y recuperación de `reliable`.
- [x] 4.2 Pruebas de `buildCandidates`: ranking, exclusión de secretos, historial desactivado, snippets.
- [x] 4.3 Pruebas del registro de atajos y de las pruebas de documentación.
- [x] 4.4 Ejecutar `pnpm test`, `vue-tsc --noEmit` y `vite build` con cero errores.

## 5. Cierre

- [x] 5.1 Ejecutar `openspec validate` y archivar el cambio.
