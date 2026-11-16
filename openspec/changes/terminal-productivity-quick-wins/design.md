# Diseño Técnico: Mejoras Rápidas de Productividad

## 1. Registro único de atajos (`src/utils/shortcuts.ts`)

```ts
export interface ShortcutDef {
  id: string;                     // "terminal.quickSelect"
  keys: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean; key: string };
  context: "global" | "terminal" | "workspace";
  titleKey: string;               // clave i18n
  group: "navigation" | "panes" | "selection" | "clipboard" | "tools";
}
export const SHORTCUTS: ShortcutDef[] = [...];       // fuente de verdad
export function matchShortcut(e: KeyboardEvent, ctx): ShortcutDef | null;
export function formatShortcut(def, platform): string;  // "Ctrl+Shift+P" / "⌘⇧P"
```
`TerminalPane.vue` sustituye su cadena de `if` por `matchShortcut` + un mapa `id → handler`. La paleta y `ShortcutsModal.vue` leen el mismo array.

### Atajos nuevos
| Atajo | Acción | Contexto |
|---|---|---|
| `Ctrl+Shift+Space` | Quick Select | Terminal |
| `Ctrl+Shift+P` | Paleta de comandos | Terminal / Workspace |
| `Ctrl+Alt+V` | Historial de pegado | Terminal |
| `Ctrl+Shift+/` | Hoja de atajos | Global |
Los atajos existentes (`Ctrl+K`, `Ctrl+B`, `Ctrl+,`, `Ctrl+F`, `Ctrl+Shift+O/D/E/W/B/↑/↓/C/V`) se migran al registro sin cambios. Se evita deliberadamente cualquier `Ctrl+<letra>` simple (readline/vim/tmux).

## 2. Quick Select (`src/utils/quick-select.ts`)
Funciones puras, probadas con Vitest:
```ts
interface Match { text: string; row: number; col: number; len: number; kind: MatchKind }
function findMatches(lines: string[], rules = DEFAULT_RULES): Match[];   // dedup por texto, orden por posición
function assignLabels(count: number, alphabet = "asdfghjklqwertyuiopzxcvbnm"): string[];  // 1 letra; 2 si count > alphabet
```
Reglas (regex por tipo): URL, ruta (`(?:~|\.{0,2})?/?[\w.-]+(?:/[\w.@+-]+)+` y `\w:\\…` en Windows), hash git `\b[0-9a-f]{7,40}\b`, IPv4 validada por octetos, IPv6, UUID, e-mail, números ≥ 4 dígitos.
Render: `term.registerMarker` + `registerDecoration` por coincidencia con una `<span>` de etiqueta (clase `.qs-label`). Entrada: mientras el modo está activo el `attachCustomKeyEventHandler` devuelve `false` para todas las teclas y las procesa el modo (sin llegar al PTY). `Escape` cancela. Mayúscula → `term.paste(text)` (respeta bracketed paste); minúscula → `navigator.clipboard.writeText`.

## 3. Paleta de comandos
`TerminalCommandPalette.vue` con búsqueda difusa (`src/utils/fuzzy.ts`: puntuación por prefijo, inicio de palabra, subsecuencia consecutiva). Fuentes de acciones: (a) `SHORTCUTS` con handler asociado, (b) snippets habilitados, (c) acciones de tema (`settingsStore.updateSettings({ theme_id })`). Cada acción declara `when(pane)` para ocultarse en paneles gráficos (RDP/VNC).

## 4. Enlaces inteligentes
`ILinkProvider` de xterm registrado con `term.registerLinkProvider` para rutas e IPs (los URLs siguen en `WebLinksAddon`). `activate(event)` solo actúa si `event.ctrlKey || event.metaKey`. El menú (`TerminalLinkMenu.vue`) ofrece:
- Ruta, sesión SSH: **Copiar** y **Mostrar en SFTP** → `sftpStore.openAt(hostId, dirname(path))`.
- Ruta, sesión local: **Copiar**.
- IP: **Conectar por SSH** (abre `QuickConnectModal` con la IP) y **Copiar**.
Validación de IP por octetos 0–255 y exclusión de cadenas de versión (`\d+(\.\d+){3,}` con 5+ segmentos).

## 5. Pegado seguro (`src/utils/paste-guard.ts`)
```ts
interface PasteAnalysis { lines: number; bytes: number; dangerous: {pattern: string; index: number; length: number}[];
                          controlChars: number; zeroWidth: number; needsConfirm: boolean; looksSecret: boolean }
function analyzePaste(text: string, opts): PasteAnalysis;
function visualizeControlChars(text: string): string;       // ESC → ␛, NUL → ␀, zero-width → ⟦200B⟧
function toSingleLine(text: string): string;
```
Intercepción: evento DOM `paste` del contenedor (fase de captura) y el atajo `Ctrl+Shift+V`; se cancela el comportamiento por defecto, se analiza y, si procede, se abre `PasteConfirmModal.vue`; al confirmar se llama a `term.paste(text)`. `needsConfirm` = más de 1 línea, patrón peligroso, caracteres de control o > 64 KiB. Patrones iniciales: `\bsudo\b`, `\brm\s+-[a-z]*r[a-z]*f`, `\bdd\s+if=`, `\bmkfs`, `chmod\s+-R\s+777`, `(curl|wget)[^|]*\|\s*(sudo\s+)?(ba|z)?sh`, `:\(\)\s*\{`.
**Historial de pegado**: `pasteHistory` en un store Pinia **solo en memoria** (nunca `localStorage`), tamaño `paste_history_size`, vaciado en `vault_lock` y al cerrar. Entradas con aspecto de secreto (`-----BEGIN … PRIVATE KEY-----`, cadena base64 > 40 caracteres sin espacios) se muestran enmascaradas.

## 6. Notificaciones de comandos largos
Hook en el manejador OSC 133 `D` existente (`TerminalPane.vue`): si `durationMs ≥ notify_threshold_seconds*1000` y `notify_long_commands` → decide el canal con `shouldNotify({windowFocused, paneVisible, activeTab})`:
- ventana sin foco → `sendNotification` de `@tauri-apps/plugin-notification` (cuerpo: `✓/✗ <host> · 12s`; el texto del comando solo con `notify_include_command`).
- ventana con foco pero pestaña oculta → *toast* interno.
- Permiso denegado / sin servicio → *toast* interno, sin error.
Al activar la notificación, evento `notification-clicked` → `window.setFocus()` + `sessionsStore.activateTab/Pane`.
Backend: `tauri-plugin-notification` registrado en `lib.rs`; capacidad `notification:default` en `src-tauri/capabilities/default.json`.

## 7. Preferencias (`AppSettings`, Rust y TypeScript)
```rust
#[serde(default = "d_true")]  pub paste_warning: bool,                // true
#[serde(default = "d_20")]    pub paste_history_size: u32,            // 20 (1..=100)
#[serde(default = "d_true")]  pub notify_long_commands: bool,         // true
#[serde(default = "d_10")]    pub notify_threshold_seconds: u32,      // 10 (1..=3600)
#[serde(default)]             pub notify_include_command: bool,       // false
```
Los valores se acotan al guardar (`clamp`) y se añade la sección en `SettingsModal.vue`.

## 8. Documentación (obligatoria en este cambio)
- `README.md` y `README.es.md`: sección de características y tabla de atajos con los 4 atajos nuevos.
- `docs/FEATURES_MANUAL.md`: nuevas secciones §4.6–§4.10 y tabla §6; **corregir §4.5** para describir el comportamiento real (se implementa en este cambio).
- `CHANGELOG.md`: entradas en `[Unreleased] → Added`.
- `docs/ROADMAP.md`: ideas tentativas (no comprometidas).
- Prueba `src/utils/shortcuts.docs.test.ts`: lee los tres documentos y falla si algún atajo del registro no aparece.

## 9. Estrategia de pruebas
Vitest: `quick-select`, `fuzzy`, `paste-guard`, `shortcuts` (conflictos, `matchShortcut`, formato por plataforma), `shouldNotify`, store de historial de pegado (límite, vaciado, enmascarado) y prueba de consistencia de documentación. Rust: valores por defecto, *clamp* y compatibilidad con JSON antiguo en `settings.rs`.

## 10. Ajustes surgidos durante la implementación
- **Quick Select usa una capa superpuesta (DOM)** en lugar de decoraciones de xterm: se posiciona a partir de las métricas de celda de `.xterm-screen`, es más sencilla y no depende de markers. El modo consume todas las teclas mediante `attachCustomKeyEventHandler`, de modo que no llegan al PTY.
- **El atajo de la paleta tiene contexto `workspace`** (no `terminal`) para poder abrirse sin tener el foco en una terminal. Las acciones dependientes de un panel se registran en `ui.store` (`registerPaneActions`) y solo aparecen si el panel activo las expone (los paneles RDP/VNC no las registran).
- **Se eliminó el listener DOM de `keydown` duplicado** de `TerminalPane.vue`: junto con el manejador de xterm ejecutaba dos veces algunos atajos. Ahora los atajos de contexto `terminal` los procesa el panel y los de `global`/`workspace` los procesa `App.vue` (el panel solo evita que lleguen al shell).
- **Pegado**: se intercepta el evento DOM `paste` en fase de captura (cubre `Ctrl+Shift+V` y el menú contextual). `Ctrl+Shift+V` y `Ctrl+Shift+C` figuran en el registro como *nativos* (documentados, no interceptados).
- **Notificaciones**: `tauri-plugin-notification` no emite eventos de clic en escritorio. Se aproxima "clic → activar panel" recordando el panel notificado y activándolo cuando la ventana recupera el foco en los 60 s siguientes (`ui.markNotified` / `consumeNotified`).
- **`notify_include_command` aún no tiene efecto**: el texto del comando no se captura hasta el cambio `terminal-productivity-advanced` (historial/bloques). La preferencia y la privacidad por defecto ya están implementadas.
- **Snippets en la paleta** ejecutan el comando con salto de línea, igual que el cajón de snippets existente, reutilizando `SnippetParamModal` para los parámetros.
- **Aviso de ruta en macOS**: los atajos usan `Cmd` en lugar de `Ctrl` (como hasta ahora); la hoja de atajos los muestra con `⌘⇧…`.
