## 1. Lógica

- [x] 1.1 `src/utils/snippet-io.ts`: `parseSnippetFile`, `serializeSnippets` y constantes de límites, con pruebas (caracteres de control/bidi/ancho cero/saltos de línea en título, comando y descripción; válido, duplicados con existentes y dentro del fichero, entradas inválidas, límites, JSON roto, formato/versión desconocidos, campos extra, round-trip).
- [x] 1.2 `snippets.store.ts`: `importSnippets(items)` secuencial con recuento de creados/errores y recarga única; pruebas del store.

## 2. Interfaz

- [x] 2.1 `SnippetImportModal.vue` (diferido): selección de fichero con límite de tamaño, resumen con cada comando completo y aviso de riesgo (`analyzePaste`), motivos y confirmación.
- [x] 2.3 Etiqueta `imported` al importar (excluida al exportar) e insignia «importado» en `SnippetDrawer.vue`, con textos y pruebas.
- [x] 2.2 Botones Importar/Exportar en `SnippetDrawer.vue` (Exportar deshabilitado sin personalizados) y textos en `es.json`/`en.json`.

## 3. Documentación

- [x] 3.1 `docs/FEATURES_MANUAL.md` (§4.2, con el esquema del formato), `docs/MANUAL_TEST_CHECKLIST.md`, `README.md`, `README.es.md`, `CHANGELOG.md` y guías del sitio.

## 4. Verificación

- [x] 4.1 `pnpm test`, `vue-tsc --noEmit` y `vite build` con cero errores (y `cargo test` por si se tocó Rust).

## 5. Cierre

- [x] 5.1 `openspec validate` y archivar el cambio.
