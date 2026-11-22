## Context

`SnippetDrawer` y `QuickConnectModal` emiten `insert-command` con `plantilla + "\n"`; `App.vue#handleInsertCommand` lo escribe tal cual con `sessionService.writeSession`. `TerminalPane` ya tiene `insertSuggestion(text, replace)` (usado por el autocompletado): aplica `analyzePaste` + aviso y escribe con `doPaste` (*bracketed paste* vía xterm), sin ejecutar.

## Decisions

1. **Nueva acción de panel `insertText`.** `ui.store` ya tiene `registerPaneActions`/`runPaneAction` para acciones sin argumentos; se añade `insertIntoPane(paneId, text): boolean` con un registro de funciones con argumento (`paneInserters`), que `TerminalPane` rellena con `(text) => insertSuggestion(text, false)`. Devuelve `false` si el panel no existe.
2. **Sin `\n`.** Los emisores dejan de añadir `"\n"`; `handleInsertCommand(command)` pasa a insertar con `insertIntoPane(activePaneId, command)`. Si devuelve `false` se muestra un aviso (toast) en lugar de fallar en silencio.
3. **Snippets con saltos de línea existentes**: `doPaste` usa *bracketed paste*, así que no se ejecutan línea a línea; el usuario pulsa `Enter` una vez.
4. **Foco.** Tras insertar se devuelve el foco a la terminal para que `Enter` ejecute de inmediato.
5. **Sin ajuste de compatibilidad**: la ejecución inmediata es el riesgo a eliminar. Se registra como cambio de comportamiento en el CHANGELOG.

## Risks / Trade-offs

- Un clic más (`Enter`) para quien ejecutaba snippets al instante: es el coste deliberado de la seguridad.
- Si el shell no activó *bracketed paste*, un snippet multilínea podría ejecutarse parcialmente; el aviso de pegado multilínea lo cubre cuando está activo.

## Migration Plan

Sin migración de datos; solo cambia el comportamiento de la selección.
