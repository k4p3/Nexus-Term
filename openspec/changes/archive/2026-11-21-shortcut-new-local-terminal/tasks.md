## 1. Registro y manejador

- [x] 1.1 Añadir `terminal.newLocal` (`Ctrl+Shift+T`, contexto `global`, grupo `navigation`) en `src/utils/shortcuts.ts`.
- [x] 1.2 Añadir `case "terminal.newLocal"` en `handleGlobalKeyDown` de `src/App.vue` reutilizando `handleOpenLocalPty()`.
- [x] 1.3 Añadir la clave `shortcuts.terminal.newLocal` en `src/locales/es.json` y `src/locales/en.json`.

## 2. Pruebas

- [x] 2.1 Añadir en `src/utils/shortcuts.test.ts` pruebas de que `Ctrl+Shift+T` resuelve a `terminal.newLocal` y de que no hay combos duplicados.
- [x] 2.2 Ejecutar `pnpm test`, `vue-tsc --noEmit` y `vite build` con cero errores.

## 3. Cierre

- [x] 3.1 Ejecutar `openspec validate` y archivar el cambio.
