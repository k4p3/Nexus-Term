# Tasks: Default Community Snippets & Snippet State Management

## 1. Backend Rust y Base de Datos SQLite

- [x] 1.1 Añadir migración en `src-tauri/src/vault/db.rs` para agregar las columnas `is_builtin INTEGER NOT NULL DEFAULT 0` e `is_enabled INTEGER NOT NULL DEFAULT 1` a la tabla `snippets`.
- [x] 1.2 Extender el struct `CommandSnippet` y `SaveSnippetPayload` en `src-tauri/src/snippets.rs` con `is_builtin: bool` e `is_enabled: bool`.
- [x] 1.3 Implementar la función de siembra `seed_community_snippets(conn)` con los 15 comandos comunitarios estándar usando `INSERT OR IGNORE`.
- [x] 1.4 Implementar la función `toggle_snippet_enabled_internal(conn, id, enabled)` y exponer el comando Tauri `toggle_snippet_enabled`.
- [x] 1.5 Ajustar `delete_snippet_internal` para conmutar a `is_enabled = false` si es un snippet `is_builtin`.
- [x] 1.6 Escribir pruebas unitarias en `src-tauri/src/snippets.rs` verificando la siembra idempotente, la conmutación de estado y el filtrado.

## 2. Frontend (Tipos, Servicio y Pinia Store)

- [x] 2.1 Actualizar las interfaces `CommandSnippet` y `SaveSnippetPayload` en `src/types/snippets.ts`.
- [x] 2.2 Agregar el método `toggleSnippetEnabled(id, enabled)` en `src/services/snippets.service.ts`.
- [x] 2.3 Actualizar `src/stores/snippets.store.ts` con acciones para conmutar estado y getters para filtrar por origen (`communitySnippets`, `customSnippets`, `enabledSnippets`).
- [x] 2.4 Actualizar las pruebas unitarias de Vitest en `src/stores/snippets.test.ts`.

## 3. Componentes Visuales y Experiencia de Usuario

- [x] 3.1 Añadir pestañas de filtro (*Todos*, *Comunidad*, *Mis Snippets*) y opción *Mostrar deshabilitados* en `src/components/snippets/SnippetDrawer.vue`.
- [x] 3.2 Añadir interruptor de activación/desactivación rápida y badge distintivo "Comunidad" en cada tarjeta de snippet en `SnippetDrawer.vue`.
- [x] 3.3 Añadir botón de clonar/duplicar en los snippets comunitarios para facilitar su personalización.

## 4. Verificación y Pruebas Finales

- [x] 4.1 Ejecutar suite completa de pruebas unitarias de Rust (`cargo test`).
- [x] 4.2 Ejecutar suite completa de pruebas de frontend (`vitest run`).
- [x] 4.3 Validar tipado estricto con `vue-tsc --noEmit`.
- [x] 4.4 Compilar el paquete de producción (`tauri build`).
