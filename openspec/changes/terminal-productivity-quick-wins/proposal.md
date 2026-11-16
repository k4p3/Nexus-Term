# Propuesta: Mejoras Rápidas de Productividad en la Terminal Interna

## 1. Resumen Ejecutivo
La terminal de NexusTerm ya cuenta con integración de shell (OSC 133), búsqueda, splits, broadcast y snippets. Esta propuesta incorpora cinco mejoras de **alto valor y bajo esfuerzo** inspiradas en terminales actuales (WezTerm, Kitty, Windows Terminal, iTerm2, Warp), junto con un **registro único de atajos** que alimenta el manejador de teclado, la paleta, una hoja de atajos dentro de la aplicación y la documentación.

## 2. Motivación y Contexto
- **Copiar cosas de la pantalla es lento**: rutas, hashes de git, IPs o UUID obligan a usar el ratón. *Quick Select* (WezTerm/Kitty) lo resuelve con el teclado.
- **Descubribilidad**: las acciones de la terminal solo se alcanzan con atajos que hay que memorizar. Una paleta (`Ctrl+Shift+P`, como Windows Terminal/Warp) y una hoja de atajos lo resuelven.
- **Seguridad al pegar**: pegar texto multilínea o con comandos destructivos, o con caracteres de control ocultos (*paste-jacking*), es un riesgo real en una terminal que gestiona servidores de producción (iTerm2 ya avisa).
- **Comandos largos**: ya medimos la duración con OSC 133; falta avisar al usuario cuando termina un comando largo y no está mirando la ventana.
- **Discrepancia de documentación detectada**: `docs/FEATURES_MANUAL.md` (§4.5) afirma que existen enlaces de rutas (`src/main.rs:10`) e IPs con menú contextual, pero el código solo carga `WebLinksAddon` (URLs). Este cambio implementa lo documentado y corrige el manual.

## 3. Alcance del Cambio

### Dentro de Alcance (In Scope)
- **Quick Select** (`Ctrl+Shift+Space`): resalta coincidencias en el viewport (URLs, rutas, hashes git, IPv4/IPv6, UUID, correos, números largos) con etiquetas de teclado; minúscula copia, mayúscula pega en el prompt.
- **Paleta de comandos de la terminal** (`Ctrl+Shift+P`): búsqueda difusa de acciones (dividir, buscar, broadcast, cambiar tema, insertar snippet, ver atajos…).
- **Enlaces inteligentes** reales: `ruta:línea[:col]` y direcciones IP con menú contextual (copiar, mostrar en SFTP, conectar por SSH).
- **Pegado seguro**: aviso con vista previa para pegados multilínea, con patrones peligrosos o caracteres de control; **historial de pegado** en memoria (`Ctrl+Alt+V`).
- **Notificación de comando largo**: notificación de escritorio al terminar un comando que supera un umbral cuando la ventana o el panel no están a la vista.
- **Registro único de atajos** (`src/utils/shortcuts.ts`) + hoja de atajos (`Ctrl+Shift+/`) + prueba que verifica que la documentación lista todos los atajos.
- **Documentación**: `README.md`, `README.es.md`, `docs/FEATURES_MANUAL.md`, `CHANGELOG.md` y `docs/ROADMAP.md` (ideas tentativas).

### Fuera de Alcance (Out of Scope)
- Atajos reconfigurables por el usuario (el registro único deja la base preparada).
- Abrir archivos locales con la aplicación del sistema (requeriría `tauri-plugin-opener`).
- Mejoras de esfuerzo medio (bloques de comandos, historial por host, *Instant Replay*, restauración de sesiones, addons de xterm): ver `terminal-productivity-advanced`.
- Ideas ambiciosas (IA, multiplexado persistente, *triggers*): solo documentadas como tentativas en `docs/ROADMAP.md`.

## 4. Capacidades Afectadas
- **`terminal-quick-select`** (nueva), **`terminal-command-palette`** (nueva), **`terminal-smart-links`** (nueva), **`terminal-paste-safety`** (nueva), **`terminal-notifications`** (nueva), **`keyboard-shortcuts`** (nueva).
- **`app-settings`**: nuevas preferencias (ver `design.md`).
- **`terminal-multiplexer`**: el manejador de teclas del panel pasa a usar el registro de atajos (sin cambio de comportamiento existente).

## 5. Cumplimiento de Licencias FOSS (GNU GPLv3)
| Paquete | Versión | Licencia | Compatible GPLv3 |
|---|---|---|---|
| `tauri-plugin-notification` (crate) | 2.8.1 | Apache-2.0 OR MIT | Sí |
| `@tauri-apps/plugin-notification` (npm) | 2.x | MIT OR Apache-2.0 | Sí (verificar en implementación) |

El resto se implementa con las APIs existentes de `@xterm/xterm`. Se debe verificar la licencia del paquete npm y del árbol transitivo antes de añadirlos.

## 6. Riesgos
- Conflictos de atajos con aplicaciones de terminal (vim, tmux, readline): se usan solo combinaciones `Ctrl+Shift+…` / `Ctrl+Alt+…` y nunca se interceptan `Ctrl+<letra>` simples.
- Notificaciones en Linux dependen de D-Bus/libnotify: se degrada a un aviso dentro de la aplicación si no están disponibles.
- Falsos positivos en la detección de patrones peligrosos: el aviso es informativo y siempre permite continuar.
