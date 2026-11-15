# Proposal

## Why

Los emuladores de terminal de última generación como Ghostty, Kitty y Warp han elevado las expectativas de productividad: la terminal ya no es un flujo ciego de caracteres, sino un entorno interactivo con detección semántica de comandos, navegación rápida entre prompts, biblioteca de snippets reutilizables y capacidad de enviar comandos a múltiples servidores a la vez (*Broadcast Mode*).

Actualmente NexusTerm cuenta con un emulador WebGL rápido y división de paneles, pero carece de detección de comandos, búsqueda interactiva en buffer y reutilización de comandos frecuentes. Esta fase dota a NexusTerm de herramientas avanzadas (*Power Tools*) tanto para la shell local como para sesiones SSH remotas.

## What Changes

- **Integración con el Shell (*Shell Integration / OSC 133*)**:
  - Detección de secuencias semánticas de prompt (`OSC 133;A` / `B` / `C` / `D`).
  - Identificación del código de retorno del comando (0 = éxito, 1+ = fallo) y tiempo transcurrido.
  - Marcadores de prompt interactivos con capacidad de saltar entre comandos con `Ctrl+Shift+↑` / `↓`.
  - Acción rápida para copiar únicamente la salida de un comando específico o el comando ejecutado.
- **Búsqueda Interactiva en Buffer (`Ctrl+F`)**:
  - Barra de búsqueda flotante acoplada al panel activo usando `@xterm/addon-search`.
  - Coincidencia exacta, expresiones regulares (`RegEx`), distinción entre mayúsculas y minúsculas y navegación bidireccional de coincidencias.
- **Modo Broadcast (*Multi-Exec*)**:
  - Control en la barra superior del multiplexor para alternar la transmisión de pulsaciones a todos los paneles divididos abiertos en la pestaña actual.
  - Indicador visual distintivo en los paneles cuando el modo Broadcast está activo.
- **Biblioteca de Snippets con Parámetros Dinámicos (`command-snippets`)**:
  - Almacenamiento cifrado de snippets organizados por etiquetas/categorías en SQLite.
  - Soporte para variables dinámicas `{{param}}` con formulario emergente para rellenar argumentos antes de enviar a la terminal activa.
  - Inserción rápida desde panel lateral o paleta `Ctrl+K`.

## Capabilities

### New Capabilities
- `command-snippets`: Creación, almacenamiento cifrado, categorización y parametrización de plantillas de comandos para inserción rápida en terminales activas.

### Modified Capabilities
- `terminal-multiplexer`: Incorporación de soporte para secuencias OSC 133 (Shell Integration), barra de búsqueda en buffer con `@xterm/addon-search`, y modo Broadcast para replicación de entrada en múltiples paneles.

## Impact

- **Backend (`src-tauri/`)**: Adición de la tabla `snippets` en SQLite y comandos Tauri para CRUD de snippets.
- **Frontend (`src/`)**:
  - Componente de búsqueda `TerminalSearchBar.vue`.
  - Componente de barra de herramientas y marcadores de prompt en `TerminalPane.vue`.
  - Componente de gestión e inserción de snippets `SnippetDrawer.vue` y `SnippetModal.vue`.
  - Indicador y lógica de replicación de teclas para modo Broadcast en `sessions.store.ts`.
