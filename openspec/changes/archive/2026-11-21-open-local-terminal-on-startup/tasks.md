## 1. Implementación

- [x] 1.1 Hacer que `openInitialLocalTab()` en `src/composables/useSessionRestore.ts` abra la local si no hay pestañas, sin depender de `lazyStart`.
- [x] 1.2 Llamarla en `onUnlocked()` tras la restauración o la ausencia de layout.

## 2. Pruebas

- [x] 2.1 Añadir pruebas en `src/composables/useSessionRestore.test.ts` para los cinco escenarios del spec.
- [x] 2.2 Ejecutar `pnpm test`, `vue-tsc --noEmit` y `vite build` con cero errores.

## 3. Cierre

- [x] 3.1 Ejecutar `openspec validate` y archivar el cambio.
