# Propuesta: Productividad Avanzada de la Terminal (Esfuerzo Medio)

## 1. Resumen Ejecutivo
Segunda fase de mejoras inspiradas en Warp, iTerm2, WezTerm, Termius y Tabby. Se apoya en `terminal-productivity-quick-wins` (registro de atajos, paleta) y en la integración OSC 133 ya existente. Incluye cinco capacidades de esfuerzo **medio**: bloques de comandos navegables, historial de comandos por host, *Instant Replay*, restauración de sesiones y addons de xterm.

## 2. Motivación y Contexto
- **Bloques de comandos**: hoy `TerminalPane.vue` guarda números de línea absolutos en `commandBlocks`; estos se desfasan cuando el *scrollback* recorta líneas. Hace falta un modelo basado en *markers* de xterm y una interfaz para actuar sobre cada bloque (copiar, repetir, buscar dentro).
- **Historial por host**: `Ctrl+R` solo ve el historial de la shell remota actual. Un historial por servidor, entre sesiones, con búsqueda difusa mejora el trabajo repetitivo sobre muchos hosts (Termius, Fig).
- **Instant Replay** (iTerm2): tras un `clear` o un reinicio de pantalla se pierde la salida; poder retroceder en el tiempo es muy útil en depuración.
- **Restaurar sesiones** (WezTerm/tmux-resurrect): al reabrir la aplicación se pierde la distribución de pestañas y paneles.
- **Compatibilidad de terminal**: Unicode 11 (emoji/anchos), portapapeles OSC 52 (copiar desde `tmux`/`vim` remoto), imágenes (sixel/iTerm) y ligaduras de tipografías de código.

## 3. Alcance del Cambio

### Dentro de Alcance (In Scope)
- **Bloques de comandos** basados en *markers*: indicador ✓/✗ y duración en el margen, selección de bloque, copiar comando/salida, **repetir comando** (`Ctrl+Shift+R`), búsqueda restringida a un bloque.
- **Historial por host**: persistencia cifrada en la bóveda, selector difuso (`Ctrl+Shift+H`) que inserta sin ejecutar (`Enter`) o ejecuta (`Ctrl+Enter`); exclusiones de seguridad y borrado.
- **Instant Replay** (`Ctrl+Shift+Y`): búfer circular **solo en memoria** con visor de línea de tiempo en solo lectura.
- **Restauración de sesiones**: guardar la distribución de pestañas/paneles y restaurarla tras desbloquear la bóveda, con reconexión diferida.
- **Addons de xterm** compatibles con xterm 5.5: `unicode11`, `clipboard` (OSC 52, solo escritura por defecto), `image` (sixel/iTerm) y `ligatures` (opcional).
- **Documentación**: README (es/en), `docs/FEATURES_MANUAL.md`, `CHANGELOG.md`, registro de atajos y `docs/ROADMAP.md`.

### Fuera de Alcance (Out of Scope)
- **Colapsar salidas de bloques**: xterm.js no permite ocultar líneas del búfer; requeriría un renderizador propio. Queda como idea tentativa en `docs/ROADMAP.md`.
- Sugerencias con IA, multiplexado persistente (`tmux` automático) y *triggers*: solo documentadas como tentativas.
- Sincronización del historial entre equipos (BYOC) y *autosuggest* tipo Fish en línea.
- Restaurar el directorio de trabajo de shells locales o el contenido de la pantalla.

## 4. Capacidades Afectadas
- **`terminal-command-blocks`**, **`terminal-history`**, **`terminal-instant-replay`**, **`session-restore`**, **`terminal-addons`** (nuevas).
- **`terminal-multiplexer`**: sustituye el modelo de líneas absolutas de OSC 133 por *markers* (requisito de integración con el shell se mantiene).
- **`vault-security`**: nueva tabla cifrada de historial.
- **`app-settings`**: nuevas preferencias.
- **`keyboard-shortcuts`** (de `terminal-productivity-quick-wins`): tres atajos nuevos.

## 5. Cumplimiento de Licencias FOSS (GNU GPLv3)
| Paquete | Versión | Licencia | Compatible GPLv3 |
|---|---|---|---|
| `@xterm/addon-unicode11` | 0.8.0 | MIT | Sí |
| `@xterm/addon-clipboard` | 0.1.0 | MIT | Sí |
| `@xterm/addon-image` | 0.8.0 | MIT | Sí |
| `@xterm/addon-ligatures` | 0.9.0 | MIT | Sí |

Versiones verificadas en npm (2026-11-15) como compatibles con `@xterm/xterm ^5.5` (las series 0.9–0.14 posteriores exigen xterm 6). Se comprobará la licencia del árbol transitivo (p. ej. `font-finder` de ligatures) antes de incorporar cada paquete.

## 6. Riesgos
- **Privacidad del historial**: los comandos pueden contener secretos. Mitigación: cifrado con la `VaultKey`, exclusión de comandos con prefijo de espacio y patrones de secreto, desactivación y borrado desde ajustes.
- **Memoria de *Instant Replay***: acotado por tiempo (5 min) y tamaño (8 MiB por panel); nunca se escribe en disco y se descarta al bloquear la bóveda.
- **Addon de imágenes y WebGL**: posible incompatibilidad con el renderizador WebGL; se resuelve en un *spike* inicial y, si falla, se activa solo con el renderizador de canvas.
- **Ligaduras**: dependen de la tipografía y pueden chocar con WebGL; quedan desactivadas por defecto.
- **Restauración**: abrir muchas conexiones al arrancar; se mitiga con reconexión diferida al activar cada pestaña.
