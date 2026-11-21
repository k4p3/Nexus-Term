## Context

El registro único (`src/utils/shortcuts.ts`) alimenta el manejador global de `App.vue`, la paleta y la hoja de atajos. Las pestañas están en `sessions.store.ts`; ya existe `activateAdjacentTab`.

## Decisions

- **Registro**: nueve entradas `app.goToTab1` … `app.goToTab9`, contexto `global`, grupo `navigation`, combo `{ code: "Digit1".."Digit9", alt: true }`. Se usa `code` porque con Alt el valor de `key` depende de la distribución del teclado (en algunas produce símbolos).
- **Etiquetas**: `CODE_LABELS` se amplía con `Digit1..9` → `1..9` para que `formatShortcut` muestre `Alt+1`.
- **Store**: nueva acción `activateTabByIndex(index: number)` (base 0); fuera de rango no hace nada. `Alt+9` llama con el índice de la última pestaña.
- **Handler**: un único bloque en `handleGlobalKeyDown` que extrae el dígito del id.
- **Documentación**: una sola fila `Alt+1..9` por documento. Como las pruebas de documentación exigen cada atajo, `goToTab1..9` se aceptan con la forma `Alt+1..9` (mismo mecanismo que `terminal.splitHAlt`) en `shortcuts.docs.test.ts` y `site.docs.test.ts`.
- **Prueba «sin Ctrl+tecla simple»**: no se ve afectada, los combos usan Alt.
- Sin cambios de IPC, SQLite ni ajustes.

## Risks

- En terminales con readline, `Alt+dígito` es el prefijo de argumento numérico, y en tmux/irssi suele cambiar de ventana. El atajo se interceptaría antes de llegar al shell. Se acepta por ser la convención establecida, y queda anotado en la documentación.
- Algunos entornos Linux reservan `Alt+dígito` para el escritorio; el cambio relativo `Ctrl+Tab` sigue disponible como alternativa.
