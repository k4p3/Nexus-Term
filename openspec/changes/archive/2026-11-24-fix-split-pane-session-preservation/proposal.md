# Proposal

## Why

Actualmente, al dividir un panel de consola (derecha/izquierda o arriba/abajo) o al cerrar un panel en una pestaña dividida, todos los paneles existentes en dicha pestaña se desmontan y vuelven a montarse en el DOM. Esto provoca que las instancias de `xterm.js` se destruyan, las sesiones SSH/PTY locales en segundo plano se cierren y se abran nuevas sesiones desde cero, perdiendo por completo la salida de los comandos en ejecución y el estado de trabajo del usuario. Además, la interfaz actual solo permite dividir hacia la derecha o abajo (`after`), careciendo de opciones para insertar el nuevo panel a la izquierda o arriba (`before`).

## What Changes

- **Preservación de instancias DOM y sesiones al modificar el árbol de paneles**: Refactorizar el renderizado de paneles en la pestaña para separar la jerarquía de posicionamiento visual (cálculo de rectángulos porcentuales del árbol binario de divisiones y sus divisores) del montaje en el DOM de las hojas (`TerminalPane` y `RemoteDesktopPane`). Al renderizar los paneles hoja en una lista plana indexada por `:key="leaf.id"` con posicionamiento absoluto calculado a partir del árbol, cualquier operación de dividir, acoplar pestaña (`dockTabIntoPane`) o cerrar panel reajustará las coordenadas y dimensiones sin desmontar ni reiniciar jamás las sesiones de los paneles sobrevivientes.
- **Redimensionado interactivo de divisores**: Permitir arrastrar las líneas divisoras entre paneles para actualizar dinámicamente la proporción (`ratio`) del nodo `split` correspondiente.
- **División direccional completa (Izquierda, Derecha, Arriba, Abajo)**: Ampliar `splitPane` y `dockTabIntoPane` con soporte de posición (`before` | `after`, por defecto `after`) y actualizar el menú contextual de división del panel para ofrecer explícitamente las 4 direcciones (Derecha, Izquierda, Abajo, Arriba).
- **Recuperación automática del foco al cerrar el panel activo**: Actualizar `activePaneId` en `closePane` cuando el panel cerrado era el activo, asignando el foco al panel vecino sobreviviente.
- **Alcance (In Scope)**:
  - Renderizado plano con preservación de DOM/sesión en pestañas divididas (`TerminalPane` y `RemoteDesktopPane`).
  - Arrastre de divisores para ajustar `ratio`.
  - Opciones de división en las 4 direcciones (izquierda, derecha, arriba, abajo) en el store y menú de panel, con traducciones `es`/`en`.
  - Actualización coherente de `activePaneId` al cerrar paneles.
  - Pruebas unitarias en Vitest para geometría de paneles, preservación de instancias Vue al dividir/cerrar y transiciones del store.
- **Fuera de Alcance (Out of Scope)**:
  - Cambios en el backend Rust (`russh` / `portable-pty`) o en los contratos IPC de Tauri (no son necesarios, ya soportan `resizeSession`).
  - Nuevos atajos de teclado globales para dividir a izquierda/arriba (se mantienen los atajos actuales documentados y se expone el control completo en el menú de división del panel).

## Capabilities

### New Capabilities

<!-- Ninguna capacidad nueva; se amplía la capacidad existente terminal-multiplexer -->

### Modified Capabilities

- `terminal-multiplexer`: Se modifica el requisito `Pestañas y Paneles Divididos (Split Panes)` para exigir explícitamente que dividir (en cualquiera de las cuatro direcciones: izquierda, derecha, arriba, abajo), acoplar o cerrar un panel preserve intactas las instancias de emulador, el historial de pantalla y las sesiones PTY/SSH/remotas de todos los demás paneles de la pestaña, además de soportar ajuste de proporciones y reasignación del panel activo al cerrar.

## Impact

- **Componentes Frontend**: `src/components/terminal/SplitPaneNode.vue` (o contenedor equivalente en `TerminalWorkspace.vue`), `src/components/terminal/TerminalPane.vue`.
- **Stores & Utilidades**: `src/stores/sessions.store.ts`, `src/utils/pane-navigation.ts` (reutilización/exportación del cálculo geométrico del árbol de paneles).
- **Internacionalización**: `src/locales/es.json` y `src/locales/en.json` para las etiquetas de dividir a la izquierda, derecha, arriba y abajo.
- **Dependencias**: Cero nuevas dependencias externas (100% compatible con la política FOSS/GPLv3 y eficiencia de RAM).
