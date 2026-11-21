# Propuesta: Navegación por Teclado entre Paneles Divididos

## 1. Resumen Ejecutivo
Permitir cambiar el panel activo de una pestaña dividida con **`Alt` + flechas** (`←` `→` `↑` `↓`), moviéndose al panel contiguo en esa dirección. Hoy los atajos de paneles solo dividen o cierran (`Ctrl+Shift+O/D/E/W`); para cambiar de panel hay que usar el ratón.

## 2. Motivación y Contexto
- AGENTS.md exige navegación completa por teclado, y esta es una carencia real del flujo con paneles divididos.
- Es la convención de iTerm2 y Tabby, y no choca con ningún atajo registrado en `src/utils/shortcuts.ts`.
- `Alt`+flechas lo usan algunos shells y programas (`readline` con saltos de palabra, `vim`, `tmux`). Por eso el atajo solo se intercepta cuando realmente mueve el foco; si no hay panel en esa dirección, la pulsación llega al shell sin cambios.

## 3. Alcance del Cambio

### Dentro de Alcance (In Scope)
- Cuatro atajos nuevos en el registro único: `terminal.focusLeft`, `focusRight`, `focusUp`, `focusDown` (`Alt+←/→/↑/↓`, contexto `terminal`, grupo `panes`).
- Función pura `findNeighborPane` (`src/utils/pane-navigation.ts`) que calcula el vecino a partir del árbol de paneles y sus proporciones (`ratio`), sin depender del DOM.
- Acción `focusNeighborPane(tabId, direction)` en `sessions.store.ts`; el foco del teclado lo recibe el panel mediante el mecanismo que ya existe para `isActive`.
- Interceptación condicionada: solo si existe vecino en esa dirección; en caso contrario la tecla pasa al shell.
- Entradas en el modal de atajos (es/en), `README.md`, `README.es.md`, `docs/FEATURES_MANUAL.md`, la lista de la checklist manual y el sitio (atajos es/en).

### Fuera de Alcance (Out of Scope)
- Atajos de siguiente/anterior panel en orden (`Ctrl+Shift+[` / `]`).
- Moverse entre pestañas distintas, o intercambiar o mover paneles de sitio.
- Atajos configurables por el usuario.
- Navegar desde dentro de un panel de escritorio remoto (RDP/VNC), que captura el teclado; sí se puede llegar *a* él.

## 4. Capacidades Afectadas
- `terminal-multiplexer` (ADDED: navegación por teclado entre paneles).

## 5. Dependencias y Licencias
No se añaden crates ni paquetes npm; sin impacto en el cumplimiento GPLv3.

## 6. Riesgos
- Conflicto con programas que usan `Alt`+flechas dentro de un panel dividido: se mitiga dejando pasar la tecla cuando no hay vecino, pero con vecino se intercepta. Queda como mejora futura hacerlo configurable.
- En macOS `Alt` es `⌥` y puede producir caracteres especiales con algunas distribuciones; se documenta en el diseño y se comprueba en la checklist.
