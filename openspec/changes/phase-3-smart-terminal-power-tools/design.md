# Design

## Context

Con las Fases 1 y 2 completadas, NexusTerm cuenta con una bóveda segura, inventario de servidores, multiplexor de terminales con pestañas y paneles divididos, soporte para temas de color ANSI estándar e internacionalización. Esta Fase 3 potencia la terminal con herramientas avanzadas inspiradas en emuladores modernos (Ghostty, Kitty, Warp), aplicables tanto a la shell local como a conexiones SSH remotas.

## Goals / Non-Goals

**Goals:**
- Implementar integración con el shell mediante secuencias OSC 133 para rastrear inicio de prompts, ejecución de comandos, códigos de retorno y saltar entre comandos.
- Ofrecer búsqueda interactiva en el buffer con resaltado y atajo `Ctrl+F` mediante `@xterm/addon-search`.
- Añadir el modo Broadcast para replicar la entrada de teclado a múltiples paneles divididos simultáneamente.
- Diseñar la biblioteca de snippets en SQLite con soporte de variables dinámicas `{{param}}`.

**Non-Goals:**
- No se incluye en esta fase un modelo de IA generativa integrado (se considerará en una fase posterior como asistente opcional).

## Decisions

### 1. Manejador OSC 133 con `registerOscHandler` en xterm.js
xterm.js soporta el registro de controladores OSC personalizados:
```ts
term.parser.registerOscHandler(133, (data) => {
  // data matches "A", "B", "C", "D;0", etc.
  const parts = data.split(';');
  const type = parts[0];
  if (type === 'A') {
    // Prompt start: registrar posición de línea
  } else if (type === 'B') {
    // Command start
  } else if (type === 'C') {
    // Command output start
  } else if (type === 'D') {
    // Command finished with exit code parts[1]
  }
  return true;
});
```
Permite almacenar una lista de marcadores de comandos con línea de inicio, línea de fin y código de salida para navegación rápida con `Ctrl+Shift+↑` / `↓`.

### 2. Barra de Búsqueda Interactiva (`TerminalSearchBar.vue`)
- Utiliza la instancia de `SearchAddon` ya cargada en cada terminal.
- Métodos invocados:
  - `searchAddon.findNext(query, { regex, matchCase, wholeWord })`
  - `searchAddon.findPrevious(query, { regex, matchCase, wholeWord })`
  - `searchAddon.clearDecorations()` al cerrar con `Esc`.

### 3. Modo Broadcast en `sessions.store.ts`
- Cada pestaña mantiene un flag `isBroadcastActive: boolean`.
- Al escribir en la terminal activa (`term.onData`), si el modo Broadcast está activo, se obtienen todos los IDs de sesiones hoja de la pestaña activa y se envía el bloque de bytes a todas las sesiones en paralelo con `sessionService.writeSession()`.
- Los paneles muestran un borde o distintivo visual ámbar mientras el modo Broadcast está activo para prevenir ejecuciones accidentales.

### 4. Esquema SQLite para Snippets (`snippets`)
```sql
CREATE TABLE IF NOT EXISTS snippets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    command_template TEXT NOT NULL,
    description TEXT,
    tags_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```
- Parámetros dinámicos: se analizan con la expresión regular `/\{\{([^}]+)\}\}/g`. Si existen parámetros, se abre un diálogo emergente para rellenarlos; si no, se escribe directamente con un salto de línea opcional.

## Risks / Trade-offs

- **[Riesgo] Shells que no tengan activado OSC 133 por defecto** → **Mitigación**: Para shells locales, inyectar variables de entorno estándar (`TERM_PROGRAM=nexus-term`) y proveer instrucciones simples para Oh My Zsh (`plugins=(... terminal-integration)`) o scripts de shell integration. La terminal funciona con normalidad aunque el shell no emita OSC 133.
- **[Riesgo] Modo Broadcast enviando comandos destructivos por error** → **Mitigación**: Mostrar una barra de advertencia visual llamativa en la parte superior del espacio de trabajo cuando el modo Broadcast esté habilitado.
