# Diseño Técnico: Navegación por Teclado entre Paneles

## 1. Modelo de datos (sin cambios)
`SplitPane { direction: "horizontal" | "vertical"; first; second; ratio }`. En `SplitPaneNode.vue`, `horizontal` = `flex-row` (`first` a la izquierda, `second` a la derecha) y `vertical` = `flex-col` (`first` arriba, `second` abajo). `ratio` es la fracción que ocupa `first`.

## 2. Algoritmo (función pura, sin DOM)
`src/utils/pane-navigation.ts`:
```ts
export type FocusDirection = "left" | "right" | "up" | "down";
export function findNeighborPane(root: PaneNode, activeId: string, dir: FocusDirection): string | null;
```
1. Recorrer el árbol asignando a cada hoja un rectángulo `{x, y, w, h}` en el cuadrado unidad, repartiendo según `direction` y `ratio` (el grosor del separador se ignora).
2. Para `right`, candidatos con `x >= activo.x + activo.w - ε`; para `left`, `x + w <= activo.x + ε`; análogo en `y` para `down`/`up`.
3. Descartar los que no se solapan con el activo en el eje perpendicular (`overlap > ε`).
4. Elegir el de menor distancia en el eje de movimiento; ante empate, el de menor distancia entre centros en el eje perpendicular; ante un nuevo empate, el primero en orden de recorrido.
5. Si no hay candidatos, devolver `null`.

## 3. Store
`sessions.store.ts`: `focusNeighborPane(tabId, dir): boolean` busca la pestaña, llama a `findNeighborPane` y, si hay resultado, `setActivePane(tabId, id)` y devuelve `true`; si no, `false` sin tocar el estado. El foco de teclado lo recibe el panel por el `watch(isActive)` que ya llama a `term.focus()` en `TerminalPane.vue`.

## 4. Atajos
- `src/utils/shortcuts.ts`: cuatro `def("terminal.focusLeft"…)` con `{ key: "arrowleft" | "arrowright" | "arrowup" | "arrowdown", alt: true }`, contexto `terminal`, grupo `panes`. `findConflicts` debe seguir sin reportar conflictos.
- `TerminalPane.vue`: en `attachCustomKeyEventHandler`, para estos cuatro ids se llama a `focusNeighborPane`; si devuelve `false` la función retorna `true` **sin** `preventDefault`, de modo que xterm envía la tecla al shell. Para el resto de atajos el comportamiento no cambia.

## 5. i18n y documentación
Claves `shortcuts.terminal.focusLeft|Right|Up|Down` en `es.json` y `en.json` (junto a `terminal.closePane`). El test `shortcuts.docs.test.ts` exige que cada atajo aparezca como `Alt+←`, `Alt+→`, `Alt+↑`, `Alt+↓` en `README.md`, `README.es.md` y `docs/FEATURES_MANUAL.md`; el sitio (`site/*/shortcuts|atajos.html`) y su test también deben listarlos.

## 6. Pruebas
- Vitest `pane-navigation.test.ts`: dos paneles en cada eje, 2×2, árbol anidado asimétrico (uno a la izquierda y dos apilados a la derecha, con distintas proporciones), sin vecino, panel único, `activeId` inexistente.
- Vitest del store: `focusNeighborPane` cambia `activePaneId` y devuelve `true`/`false` según corresponda sin modificar nada cuando no hay vecino.
- `shortcuts.test.ts` ya valida conflictos y coincidencia de combinaciones; añadir casos para `Alt+flecha` y comprobar que `Ctrl+Shift+flecha` (prompts) sigue resolviéndose igual.
