## Context

- El historial por host está cifrado y se consulta con `history_search` (`vault/history.rs`); `HistoryPicker.vue` ya combina historial y snippets con `rankHistory` (`history-filter.ts`).
- `TerminalPane.vue` centraliza la entrada en `term.onData`, que escribe al PTY con `sessionService.writeSession`.
- La terminal no tiene un editor de línea propio: el prompt lo gestiona el shell. Sin OSC 133 no se puede leer la línea real del búfer de forma fiable, por eso esta primera entrega reconstruye la línea desde las teclas. La lectura exacta con OSC 133 llega en `autocomplete-inline-suggestion`.

## Decisions

- **`LineBuffer` (`src/utils/line-buffer.ts`)**: clase pura que consume cada `data` de `onData` y mantiene `text` y `reliable`.
  - Imprimibles se añaden; `\x7f`/`\b` borra el último carácter; `\x15` (Ctrl+U) y `\x17` (Ctrl+W, palabra) vacían o recortan; `\r`/`\n`/`\x03` reinician y recuperan `reliable = true`.
  - Secuencias de escape (flechas, Inicio/Fin, Supr), `\t`, `\x12` (Ctrl+R), `\x10`/`\x0e` (historial del shell) y entradas multi-carácter con saltos (pegado) marcan `reliable = false` hasta el siguiente reinicio.
  - Solo vive en memoria del componente; no se serializa ni se registra (regla 1 de `AGENTS.md`).
- **Candidatos compartidos (`src/utils/completion-candidates.ts`)**: función pura `buildCandidates(history, snippets, query, { historyEnabled })` que devuelve entradas ordenadas, excluyendo las entradas de historial que coincidan con `SECRET_PATTERNS` (los snippets los escribe el usuario y no se filtran). `HistoryPicker.vue` pasa a usarla, y la reutilizará la sugerencia en gris.
- **Popup (`AutocompletePopup.vue`)**, cargado con `defineAsyncComponent` (regla 7). Se ancla al cursor calculando la celda a partir de `cursorX/cursorY` y del tamaño de `.xterm-screen` entre `cols`/`rows`; si no cabe debajo, se abre por encima. Máximo 8 filas con desplazamiento.
- **No roba el foco**: las teclas del popup se capturan en `attachCustomKeyEventHandler` mientras está abierto (`↑`, `↓`, `Tab`, `Esc`); el resto pasa al shell y alimenta `LineBuffer`. `Enter` nunca se intercepta.
- **Aceptar**: si `reliable`, se envía `\x15` (borrar hasta el inicio de línea) más el texto elegido, asumiendo cursor al final; si no es fiable, solo se inserta el texto. Nunca se añade `\r`.
- **Atajo**: `terminal.autocomplete` = `Ctrl+Space` (`code: "Space"`, contexto `terminal`, grupo `tools`). Hay que añadirlo a la lista de permitidos de la prueba «sin Ctrl+tecla simple» y verificar que no colisiona con `terminal.quickSelect` (`Ctrl+Shift+Space`).
- **Pantalla alterna**: se comprueba `term.buffer.active.type === "alternate"`; en ese caso el atajo no se consume.
- **Sin ajustes nuevos ni cambios de IPC/SQLite.** Si `history_enabled` es falso solo se ofrecen snippets.

## Risks

- **La línea reconstruida puede descuadrarse** (alias que expanden, edición con flechas, `Ctrl+R`). Se mitiga con `reliable` y con el modo «sin filtro» que no borra nada.
- **Secretos tecleados sin eco** (contraseña de `sudo`): `LineBuffer` los vería como texto. No se persisten ni se muestran si el popup está cerrado, y las entradas que coinciden con patrones secretos no se ofrecen. La lectura con OSC 133 del siguiente cambio permitirá distinguir mejor el prompt de comando de otras entradas.
- **`Ctrl+Space` en readline/emacs es «set-mark»** (`C-@`): se pierde en la terminal. Se acepta porque es poco usado y se documenta.
- **Posición del popup** con cambios de fuente o `zoom`: se recalcula en cada apertura, no se persiste.
