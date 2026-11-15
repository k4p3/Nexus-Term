# Tasks

## 1. Backend de Snippets en Rust y Migración SQLite

- [ ] 1.1 Añadir la tabla `snippets` a las migraciones SQLite en `src-tauri/src/vault/db.rs`, crear el módulo `src-tauri/src/snippets.rs` con operaciones CRUD y comandos Tauri (`get_snippets`, `save_snippet`, `delete_snippet`), verificando con `cargo test`.

## 2. Herramientas de Terminal (Búsqueda, OSC 133 y Modo Broadcast)

- [ ] 2.1 Construir el componente `src/components/terminal/TerminalSearchBar.vue` y conectarlo con `SearchAddon` en `TerminalPane.vue` con atajo `Ctrl+F` y navegación de coincidencias.
- [ ] 2.2 Implementar el manejador de secuencias semánticas OSC 133 en `TerminalPane.vue` con seguimiento de inicio/fin de comandos, códigos de retorno, atajos `Ctrl+Shift+Up` / `Down` para saltar entre prompts y botón de copiar salida.
- [ ] 2.3 Implementar el modo Broadcast en `sessions.store.ts` y `TerminalWorkspace.vue`, con barra de advertencia visual y replicación de pulsaciones a todos los paneles divididos de la pestaña activa.

## 3. Biblioteca de Snippets Frontend e Internacionalización

- [ ] 3.1 Crear el servicio `src/services/snippets.service.ts` y el store `src/stores/snippets.store.ts`.
- [ ] 3.2 Construir los componentes `src/components/snippets/SnippetDrawer.vue` y `SnippetModal.vue` con detección y sustitución interactiva de parámetros dinámicos `{{param}}`, integrándolo en el encabezado y en la paleta `Ctrl+K`.
- [ ] 3.3 Agregar las claves de internacionalización correspondientes en `src/locales/en.json` y `src/locales/es.json`.

## Workflow follow-up

- Validar especificaciones con `openspec validate --all --strict`.
