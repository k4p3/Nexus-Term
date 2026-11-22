## Context

`shell-integration-injection` hace que los terminales locales emitan OSC 133, y `BlockTracker` (`src/utils/command-blocks.ts`) ya conoce, por bloque, el marker del prompt y `commandStartX` (columna donde empieza la entrada). `autocomplete-popup` aportó `buildCandidates`, `anchorPopup` y la detección de pantalla alternativa. Falta pintar texto fantasma y gestionar su aceptación.

## Goals / Non-Goals

**Goals:** sugerencia por prefijo fiable (leída de pantalla), aceptación con una tecla, cero riesgo de ejecutar algo sin querer, coste mínimo por pulsación.

**Non-Goals:** completado de flags/subcomandos con *command specs* (hoja de ruta), sugerencias por IA, sugerencia a mitad de línea, shells sin OSC 133.

## Decisions

1. **Leer la línea de pantalla.** Si el último bloque tiene `commandStart` y no `outputStart` (estamos en la entrada), el texto es el de las celdas del buffer activo desde `(commandStartX, línea del marker commandStart)` hasta el cursor, uniendo líneas envueltas (`isWrapped`). Función pura `readInputLine(buffer, block)` → `{ text, cursorAtEnd }`, con `cursorAtEnd` = no hay texto no vacío a la derecha del cursor en esa línea. Si el cursor queda fuera del bloque o el texto ocupa más de 5 filas, se oculta. Descartado: reutilizar `LineBuffer` (se invalida con flechas/Tab) o pedirle la línea al shell.
2. **Coincidencia.** `suggestFor(text, history, snippets, historyEnabled)` busca entradas cuyo texto empiece por `text` (sensible a mayúsculas), con `text.length >= 2` y distinto del texto completo, sin saltos de línea. Orden: `use_count` desc, `last_used_at` desc; los snippets solo se consideran si no hay candidato de historial y su plantilla no contiene `{{`. Se reutiliza `toCandidates` (excluye secretos).
3. **Pintado con decoración de xterm.** `term.registerDecoration({ marker: cursorMarker, x: cursorX, width: suffix.length })`, con `onRender` que fija el texto y `color: var(--theme-fg-muted)`, `pointer-events: none`, `opacity .6`, aplicando propiedades con `Object.assign` (no `cssText`, para no pisar la posición que fija xterm). Se destruye y recrea al cambiar; no se anima.
4. **Cuándo recalcular.** En `term.onWriteParsed` y `term.onCursorMove`, con *debounce* a `requestAnimationFrame` (un único cálculo por frame). Se limpia al instante en alternate screen, selección activa o apertura del popup. Sin historial cargado se llama a `history.load` una sola vez por host.
5. **Aceptación.** En `attachCustomKeyEventHandler`, y solo si hay sugerencia visible y no hay modificadores salvo `Ctrl` para la palabra: `ArrowRight`/`End` insertan el sufijo; `Ctrl+ArrowRight` el siguiente tramo `^\s*\S+`. La inserción usa `term.paste`-like vía el mismo `insertSuggestion(text, false)` del popup (con su aviso de pegado seguro). Si no hay sugerencia, la tecla no se consume. `Enter`/`Tab` nunca se interceptan.
6. **Ajuste.** `inline_suggestion: bool` (`#[serde(default = "default_true")]`) en `AppSettings` y casilla en la pestaña de terminal. Al desactivarse se limpia la decoración vía `watch`.
7. **Sin atajos nuevos en el registro.** Son teclas contextuales; la prueba de documentación de atajos no cambia, pero se documentan en manual, READMEs y sitio.

## Risks / Trade-offs

- **Prompts con cursor movido por el shell** (zsh con RPROMPT, p10k transient): `cursorAtEnd` por celdas puede dar falsos positivos → se comprueba que el texto a la derecha del cursor esté vacío y, ante duda, se oculta.
- **Robo de `→`/`End`**: solo se consumen con sugerencia visible y cursor al final, caso en el que el shell haría de todos modos nada útil (en zsh/fish esas teclas ya aceptan su propia sugerencia; si el usuario tiene autosuggestions propias puede desactivar el ajuste).
- **Coste**: un cálculo por frame sobre ≤2000 entradas; si fuese notable, se cachea el último prefijo.
- **Texto fantasma sobre el contenido**: la decoración ocupa celdas ya vacías de la línea; si la sugerencia no cabe, se recorta al ancho restante.

## Migration Plan

Solo aditivo. Ajustes antiguos cargan con `inline_suggestion = true`. Sin migración de datos.

## Open Questions

- Si resulta incómodo `End`, valorar quitarlo y dejar solo `→`.
