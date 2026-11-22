## Why

El popup de `Ctrl+Space` exige pedir la ayuda. Las terminales modernas muestran, mientras se teclea, la **continuación probable en gris** a partir de lo ya usado, y basta una tecla para aceptarla. Con la inyección de OSC 133 (`shell-integration-injection`) ya sabemos con precisión dónde empieza la línea de comandos, de modo que se puede leer lo escrito directamente de la pantalla en lugar de adivinarlo por las teclas.

Es el tercer y último paso de la línea `autocomplete-popup` → `shell-integration-injection` → `autocomplete-inline-suggestion`.

## What Changes

- **Sugerencia en gris** tras el cursor: la mejor coincidencia **por prefijo** del historial del host (o `local`) y de los snippets habilitados, sin ejecutar nada.
- Aceptar con `→` o `End` (solo si el cursor está al final de la línea) la sugerencia completa; con `Ctrl+→`, solo la siguiente palabra. Cualquier otra tecla sigue su curso normal y la sugerencia se recalcula.
- **Lectura de la línea desde la pantalla** (OSC 133 `B`→cursor) en lugar de `LineBuffer`, por lo que es correcta incluso tras flechas, `Tab` o historial del shell. Sin marcas OSC 133 en el shell no se muestra nada.
- Se oculta en pantalla alternativa, con el popup abierto, con selección activa, con texto multilínea o cuando el cursor no está al final de lo escrito.
- Nuevo ajuste `inline_suggestion` (por defecto activado) en *Ajustes → Terminal*, con campo en Rust (`#[serde(default)]`).
- Respeta las reglas de privacidad del historial (entradas con secretos nunca se sugieren) y la sugerencia solo vive en memoria.
- Sin dependencias nuevas (no aplica verificación de licencias). Componentes diferidos con `defineAsyncComponent` donde proceda; la decoración es una utilidad ligera sin UI propia.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `terminal-autocomplete`: añade el requisito de sugerencia en línea.
- `app-settings`: añade `inline_suggestion`.
- `keyboard-shortcuts`: documenta `→`/`End`/`Ctrl+→` como teclas de aceptación contextuales (no son atajos globales del registro).

## Impact

- Nuevos: `src/utils/inline-suggestion.ts` (cálculo puro de la sugerencia y lectura de la línea), `src/composables/useInlineSuggestion.ts` y sus pruebas.
- Modificados: `src/components/terminal/TerminalPane.vue` (decoración, teclas, recálculo en `onWriteParsed`), `src/utils/completion-candidates.ts` (búsqueda por prefijo), `src-tauri/src/settings.rs`, `src/types/settings.ts`, `src/stores/settings.store.ts`, `SettingsModal.vue`, `src/locales/{es,en}.json`, documentación y sitio, `CHANGELOG.md`.
