# Tareas: Navegación por Teclado entre Paneles

## 1. Lógica
- [x] 1.1 `findNeighborPane` en `src/utils/pane-navigation.ts` + pruebas (ejes, 2×2, anidado asimétrico, sin vecino, panel único, id inexistente)
- [x] 1.2 `focusNeighborPane(tabId, dir)` en `sessions.store.ts` + pruebas

## 2. Atajos e integración
- [x] 2.1 Registrar `terminal.focusLeft|Right|Up|Down` (`Alt+flechas`) en `src/utils/shortcuts.ts` y ampliar pruebas
- [x] 2.2 `TerminalPane.vue`: acción en el manejador de teclas; si no hay vecino, la tecla pasa al shell sin `preventDefault`
- [x] 2.3 Claves i18n es/en para el modal de atajos

## 3. Documentación
- [x] 3.1 `README.md`, `README.es.md`, `docs/FEATURES_MANUAL.md` (tabla de atajos y sección de paneles)
- [x] 3.2 Sitio: atajos es/en (y guía si procede) manteniendo la paridad
- [x] 3.3 `docs/MANUAL_TEST_CHECKLIST.md` y `CHANGELOG.md`

## 4. Validación
- [x] 4.1 `cd src-tauri && cargo test`
- [x] 4.2 `pnpm test`, `pnpm vue-tsc --noEmit`, `pnpm build`
- [x] 4.3 Prueba manual en Linux: `Alt+flechas` cambia de panel (pendiente de comprobar por quien lo use: paso de la tecla a `vim`/`readline` sin vecino y `⌥`+flecha en macOS)
- [x] 4.4 `openspec validate` y archivar al terminar
