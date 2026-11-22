## Why

Al elegir un snippet (cajón de snippets o `Ctrl+K`) la aplicación escribe `comando + "\n"` directamente en el PTY: el comando **se ejecuta al instante**, sin ver el resultado de rellenar parámetros en el prompt y sin pasar por las comprobaciones del pegado seguro. Es un riesgo con cualquier snippet y se agrava al poder importarlos de ficheros ajenos (`snippets-import-export`). Aceptar una sugerencia del autocompletado ya funciona al revés: solo inserta, y el usuario decide con `Enter`.

## What Changes

- Elegir un snippet **inserta el texto en el prompt sin ejecutarlo** (sin `\n` final); el usuario lo revisa, lo edita si quiere y pulsa `Enter`.
- La inserción pasa por la **acción de pegado del panel activo**, de modo que aplica el aviso del pegado seguro (comandos de riesgo o multilínea) y el *bracketed paste*, que evita que un snippet multilínea se ejecute por líneas.
- Aplica a todos los orígenes: cajón de snippets (con y sin parámetros), paleta `Ctrl+K` (Quick Connect) y cualquier otro que use `insert-command`.
- Sin ajuste para volver al comportamiento anterior: la ejecución inmediata es justo el riesgo que se elimina. (Se puede reevaluar como opción explícita más adelante.)
- Solo frontend, sin dependencias nuevas (no aplica verificación de licencias).

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `command-snippets`: la selección de un snippet inserta sin ejecutar.

## Impact

- Modificados: `src/App.vue` (`handleInsertCommand`), `src/components/snippets/SnippetDrawer.vue`, `src/components/hosts/QuickConnectModal.vue`, `src/stores/ui.store.ts` (nueva acción de panel `insertText`), `src/components/terminal/TerminalPane.vue` (registra `insertText` reutilizando `insertSuggestion`), `src/locales/{es,en}.json` (pistas), documentación, sitio y `CHANGELOG.md`.
- Cambio de comportamiento visible: quien esperaba ejecución inmediata debe pulsar `Enter`.
