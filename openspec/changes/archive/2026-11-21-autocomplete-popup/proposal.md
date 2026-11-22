## Why

Hoy recuperar un comando anterior exige abrir el selector de historial (`Ctrl+Shift+H`), que roba el foco y se escribe en un campo aparte. Mientras se teclea en la terminal no hay ayuda alguna. Se quiere un autocompletado ligero, al estilo de las terminales modernas, usando lo que ya existe: el historial cifrado por host y la biblioteca de snippets.

Es el primer paso de una línea de trabajo en tres cambios (`autocomplete-popup` → `shell-integration-injection` → `autocomplete-inline-suggestion`). Esta primera entrega no depende de OSC 133, así que funciona en cualquier shell.

## What Changes

- Nuevo atajo `Ctrl+Space` (contexto terminal) que abre un **popup anclado al cursor** con las coincidencias del historial del host (o `local`) y de los snippets habilitados, ordenadas con `rankHistory`.
- El popup **no roba el foco**: se sigue escribiendo en la terminal y la lista se filtra en vivo con lo tecleado desde el último prompt.
- Con el popup abierto: `↑`/`↓` navegan, `Tab` acepta la selección (sustituye lo escrito), `Esc` lo cierra. `Enter` pasa siempre al shell tal cual, de modo que nunca ejecuta algo que el usuario no haya aceptado antes.
- Un **seguimiento de la línea actual** en memoria (`LineBuffer`) a partir de las teclas enviadas. Se invalida (y el popup pasa a modo «sin filtro») ante teclas que lo descuadran: flechas, `Tab`, `Ctrl+R`, pegado, historial del shell.
- Se extrae la construcción de candidatos de `HistoryPicker` a una utilidad compartida, que reutilizará la futura sugerencia en gris.
- Solo frontend: **sin cambios en Rust, sin dependencias nuevas** (no aplica verificación de licencias). El componente se carga con `defineAsyncComponent`.

## Capabilities

### New Capabilities
- `terminal-autocomplete`: autocompletado de comandos en la terminal a partir del historial y los snippets.

### Modified Capabilities
- `keyboard-shortcuts`: se añade el atajo `Ctrl+Space`.

## Impact

- Nuevos: `src/utils/line-buffer.ts`, `src/utils/completion-candidates.ts`, `src/components/terminal/AutocompletePopup.vue` y sus pruebas.
- Modificados: `src/components/terminal/TerminalPane.vue`, `src/components/terminal/HistoryPicker.vue` (usa la utilidad compartida), `src/utils/shortcuts.ts` y su prueba, `src/locales/{es,en}.json`, `README.md`, `README.es.md`, `docs/FEATURES_MANUAL.md`, `site/en/{guide,shortcuts}.html`, `site/es/{guia,atajos}.html`, `CHANGELOG.md`.
