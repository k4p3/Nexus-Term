## 1. Backend

- [x] 1.1 Añadir `inline_suggestion` (por defecto `true`, `#[serde(default = "default_true")]`) en `src-tauri/src/settings.rs`, con prueba de compatibilidad con ajustes antiguos.

## 2. Frontend

- [x] 2.1 `src/utils/inline-suggestion.ts`: `readInputLine(buffer, block)` y `suggestFor(...)`, `nextWord(suffix)`, con pruebas (prefijo, mínimo 2 caracteres, secretos, multilínea, snippets con `{{`, cursor no al final, líneas envueltas).
- [x] 2.2 `useInlineSuggestion.ts`: estado, recálculo por frame, ocultación (alt-screen, selección, popup, sin OSC 133) y aceptación; con pruebas.
- [x] 2.3 Integrar en `TerminalPane.vue`: decoración, teclas `→`/`End`/`Ctrl+→` condicionadas, `watch` del ajuste y limpieza al desmontar.
- [x] 2.4 Ajuste en `src/types/settings.ts`, `settings.store.ts`, `SettingsModal.vue` y textos `es.json`/`en.json`.

## 3. Documentación

- [x] 3.1 `docs/FEATURES_MANUAL.md` (§4.1.1), `docs/MANUAL_TEST_CHECKLIST.md`, `README.md`, `README.es.md`, `CHANGELOG.md` y guías/atajos del sitio.

## 4. Verificación

- [x] 4.1 `cd src-tauri && cargo test`, `pnpm test`, `vue-tsc --noEmit` y `vite build` con cero errores.

## 5. Cierre

- [x] 5.1 `openspec validate` y archivar el cambio.
