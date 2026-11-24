# Design

## Context

Véase `proposal.md` para la motivación del problema. En el código actual (`src/components/terminal/SplitPaneNode.vue`), el árbol binario `PaneNode` (`SplitPane | LeafPane`) se renderiza recursivamente en Vue:

```text
Estado inicial (1 panel):
  SplitPaneNode (rootPane = Leaf A)
    └── TerminalPane (key="pane-A")

Tras dividir Leaf A:
  SplitPaneNode (rootPane = Split S1)
    ├── SplitPaneNode (first = Leaf A)
    │     └── TerminalPane (key="pane-A")   <-- ¡Nueva profundidad en el árbol VDOM!
    └── SplitPaneNode (second = Leaf B)
          └── TerminalPane (key="pane-B")
```

En Vue 3, la reconciliación por `:key` solo opera entre nodos hermanos dentro del mismo contenedor padre. Cuando una hoja (`LeafPane`) pasa de renderizarse directamente a estar envuelta dentro de un nuevo `<SplitPaneNode>` hijo (al dividir) o sube un nivel en el árbol (al cerrar a su hermano y colapsar el `SplitPane`), Vue destruye el subárbol anterior —ejecutando `onBeforeUnmount` en `TerminalPane.vue` / `RemoteDesktopPane.vue`, que llama a `sessionService.closeSession(sessionId)` y `term.dispose()`— y monta una instancia completamente nueva que abre una sesión desde cero en `onMounted`.

Restricciones aplicables:
- No se requieren cambios en Tauri IPC ni en esquemas SQLite (`vault.db`); los comandos existentes (`open_local_pty`, `connect_ssh`, `resize_session`, `close_session`) y el formato persistido `SessionLayout` (`version: 1`) ya modelan árboles `split` con `direction` (`horizontal` | `vertical`), `first`, `second` y `ratio`.
- `RemoteDesktopPane.vue` DEBE seguir cargándose mediante `defineAsyncComponent` (regla obligatoria de Lazy Loading para eficiencia de RAM en WebKitGTK).
- Cero secretos o contenido del buffer en estado serializado.

## Goals / Non-Goals

**Goals:**
- Garantizar identidad de montaje estable (`v-for="leaf in leaves" :key="leaf.id"`) para todos los paneles de una pestaña independientemente de cuántas veces cambie la profundidad o topología de `tab.rootPane`.
- Soportar división en las 4 direcciones cardinales (`left`, `right`, `up`, `down`) reutilizando el modelo `SplitPane` existente (`horizontal`/`vertical` + orden `first`/`second`), manteniendo 100% de compatibilidad con `SessionLayout` y navegación `Alt+Flechas`.
- Soportar redimensionado fluido con el ratón sobre los divisores actualizando `ratio` (acotado a `[0.1, 0.9]`).
- Asegurar que `closePane` actualice `tab.activePaneId` cuando se cierra el panel con foco.

**Non-Goals:**
- Re-parenting manual de nodos HTML fuera de Vue (`appendChild` imperativo) o portales complejos por panel.
- Modificar los canales binarios IPC de Rust (`src-tauri/`).
- Mover paneles vivos entre pestañas distintas sin desmontarlos (el caso `dockTabIntoPane` entre dos pestañas distintas seguirá moviendo la estructura, preservando intactos todos los paneles de la pestaña destino).

## Decisions

### 1. Renderizado Plano Basado en Geometría Calculada vs. Árbol DOM Recursivo

- **Decisión**: Reemplazar la recursión de componentes en `SplitPaneNode.vue` por un contenedor plano por pestaña que calcula síncronamente a partir de `tab.rootPane`:
  1. `leafRects`: Lista de hojas `{ pane: LeafPane, x, y, w, h }` en coordenadas normalizadas `[0, 1]`.
  2. `splitters`: Lista de divisores `{ id, direction, x, y, w, h, containerRect: { x, y, w, h }, ratio }` correspondientes a cada nodo `split` interno.

```text
+-------------------------------------------------------------------+
| Contenedor relativo de la pestaña (position: relative; w/h: 100%) |
|                                                                   |
|   Capa 1: v-for="item in leafRects" :key="item.pane.id"           |
|    <div style="position:absolute; left:..%; top:..%; w:..%; h:..%">|
|      <TerminalPane /> o <RemoteDesktopPane />                     |
|    </div>                                                         |
|                                                                   |
|   Capa 2: v-for="sep in splitters" :key="sep.id"                  |
|    <div @pointerdown="startResize(sep, $event)" ... />            |
+-------------------------------------------------------------------+
```

- **Por qué**:
  - Como todos los paneles hoja de la pestaña son hermanos directos en un único `v-for` con `:key="item.pane.id"`, añadir o quitar divisiones en cualquier nivel del árbol únicamente actualiza los estilos CSS `left`, `top`, `width` y `height` de los paneles existentes.
  - Vue jamás ejecuta `onBeforeUnmount` / `onMounted` sobre los paneles sobrevivientes.
  - El `ResizeObserver` ya instalado en `TerminalPane.vue` y `RemoteDesktopPane.vue` detecta automáticamente el nuevo tamaño del contenedor absoluto, ejecuta `fitAddon.fit()` y envía `sessionService.resizeSession(sessionId, cols, rows)` al PTY sin perder un solo byte del buffer ni de `BlockTracker` / `InstantReplay`.
  - Se reutiliza y extiende la lógica geométrica pura que ya existe en `src/utils/pane-navigation.ts` (`layoutLeaves`), evitando duplicar matemáticas de layout.
- **Alternativas descartadas**:
  - *Árbol DOM recursivo con `<Teleport>`*: Requiere crear destinos DOM antes de montar las hojas, introduce condiciones de carrera en el ciclo de actualización de Vue y pierde el contexto WebGL de `<canvas>` en algunos motores WebKitGTK cuando un nodo se mueve en el DOM mediante `appendChild`. Con posicionamiento absoluto plano, el nodo DOM nunca cambia de padre.

### 2. Modelado de División en 4 Direcciones (`before` / `after`)

- **Decisión**: Añadir un parámetro opcional `placement: SplitPlacement = "after"` (`"before" | "after"`) a `sessionsStore.splitPane(...)` y `sessionsStore.dockTabIntoPane(...)` (además de una acción `setSplitRatio(tabId, splitId, ratio)` en el store).
  - Dividir a la **Derecha**: `direction = "horizontal"`, `placement = "after"` (`first = actual, second = nuevo`).
  - Dividir a la **Izquierda**: `direction = "horizontal"`, `placement = "before"` (`first = nuevo, second = actual`).
  - Dividir **Abajo**: `direction = "vertical"`, `placement = "after"` (`first = actual, second = nuevo`).
  - Dividir **Arriba**: `direction = "vertical"`, `placement = "before"` (`first = nuevo, second = actual`).
- **Por qué**: El árbol binario `SplitPane` ya representa cualquier disposición mediante `direction` + orden `(first, second)`. No requiere migrar `SessionLayout` ni alterar `findNeighborPane` ni los tests existentes (cuyo valor por defecto `"after"` conserva compatibilidad total hacia atrás).
- **UI en `TerminalPane.vue`**: En el menú contextual de división (`isSplitMenuOpen`), ampliar el selector de dirección para mostrar los 4 modos claramente identificables (Izquierda, Derecha, Arriba, Abajo) con iconos y tooltips traducidos en `es.json` y `en.json`.

### 3. Separación Visual y Arrastre de Divisores (`Splitters`)

- **Decisión**: Reservar un grosor visual limpio entre paneles (p. ej. `gap` de 2px / `calc(...)` o borde de 1px con zona interactiva `hit-area` de `6px` centrada con `z-20`) y gestionar el arrastre con eventos de puntero (`pointerdown` → `pointermove` / `pointerup` sobre `window`).
  - Durante el arrastre se calcula la posición relativa del puntero dentro del rectángulo del nodo `split` padre (`(relX - sep.containerX) / sep.containerW` o eje Y en vertical), acotada a `[0.1, 0.9]`, invocando `sessionsStore.setSplitRatio(tabId, sep.id, newRatio)`.

### 4. Reasignación de `activePaneId` en `closePane`

- **Decisión**: Antes de eliminar `targetPaneId` en `closePane(tabId, targetPaneId)`, si `tab.activePaneId === targetPaneId`, elegir como nuevo `activePaneId` el vecino más cercano usando `findNeighborPane` (probando `left`, `up`, `right`, `down`) o, en su defecto, la primera hoja restante del nuevo árbol.

### 5. Contratos IPC, SQLite y Seguridad

- **Contratos Tauri IPC**: Sin cambios. Se sigue invocando `resize_session` cuando el `ResizeObserver` de cada panel detecta el cambio de geometría CSS.
- **SQLite / Criptografía**: Sin cambios en `vault.db`.
- **Lazy Loading**: `SplitPaneNode.vue` mantiene `const RemoteDesktopPane = defineAsyncComponent(() => import("../remote/RemoteDesktopPane.vue"))`, garantizando que el código de RDP/VNC nunca se cargue en memoria mientras solo existan paneles de terminal.

## Risks / Trade-offs

- **[Riesgo] Redimensionados excesivos al arrastrar el divisor** → Mitigación: Actualizar el layout CSS de inmediato y delegar en el `ResizeObserver` nativo (que agrupa por frame de renderizado); `resizeSession` solo se envía cuando cambian efectivamente `cols` o `rows` enteros o al ajustar `fitAddon.fit()`.
- **[Riesgo] Pérdida de foco cuando se cierra el panel activo** → Mitigación: Al actualizar `tab.activePaneId` en el store, el `watch(() => props.isActive)` ya existente en `TerminalPane.vue` y `RemoteDesktopPane.vue` enfoca automáticamente el nuevo panel activo en `nextTick`.
- **[Riesgo] Acoplar otra pestaña (`dockTabIntoPane`)** → Mitigación: Los paneles que ya estaban en la pestaña destino mantienen el mismo padre DOM y no se reinician; los paneles provenientes de `sourceTab` pasan al contenedor de `targetTab` (operación explícita de mover pestaña). Documentado claramente en escenarios y pruebas.
