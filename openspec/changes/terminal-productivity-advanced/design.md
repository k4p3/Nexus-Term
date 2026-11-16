# Diseño Técnico: Productividad Avanzada de la Terminal

## 1. Bloques de comandos (`src/utils/command-blocks.ts`)
Se sustituye `commandBlocks` (números de línea absolutos) por un modelo con *markers*:
```ts
interface CommandBlock {
  id: number;
  prompt: IMarker;           // term.registerMarker en OSC 133;A
  commandStart?: IMarker;    // ;B
  outputStart?: IMarker;     // ;C
  end?: IMarker;             // ;D
  exitCode?: number; durationMs?: number; startedAt?: number;
}
class BlockTracker { onOsc(action: "A"|"B"|"C"|"D", args: string[], term): void;
                     blocks(): CommandBlock[]; prune(): void;   // elimina bloques con marker.isDisposed
                     commandText(b, term): string; outputText(b, term): string; }
```
`marker.line` se mantiene al recortar el *scrollback* y `marker.onDispose` retira el bloque. Margen: `registerDecoration({ marker, x: 0, width: 1 })` con ✓/✗ y tooltip de duración. Acciones: copiar comando/salida (lectura de `buffer.active.getLine(i).translateToString`), búsqueda acotada (rango de líneas del bloque sobre el texto), repetir comando (`Ctrl+Shift+R`).
**Limitación conocida**: xterm.js no puede ocultar líneas, por lo que *colapsar* salidas no es viable sin renderizador propio (ver `docs/ROADMAP.md`).

## 2. Historial por host
### Esquema SQLite
```sql
CREATE TABLE IF NOT EXISTS command_history (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,               -- id de host, o 'local' para shells locales
  dedupe_key TEXT NOT NULL,            -- sha256(host_id || 0x00 || comando) en hex
  encrypted_command BLOB NOT NULL,     -- AES-256-GCM con VaultKey
  use_count INTEGER NOT NULL DEFAULT 1,
  last_exit_code INTEGER,
  last_used_at TEXT NOT NULL,
  UNIQUE(host_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_history_host_recent ON command_history(host_id, last_used_at DESC);
```
La cascada al borrar un host se implementa con un *trigger* `AFTER DELETE ON hosts` (una FK impediría usar la clave `local`).
El hash de deduplicación revela únicamente igualdad entre comandos del mismo host; el texto va siempre cifrado.
### Contratos IPC
| Comando | Entrada | Salida |
|---|---|---|
| `history_record` | `{ host_id, command, exit_code? }` | `()` |
| `history_search` | `{ host_id, query?, limit }` | `HistoryEntry[]` (descifradas en memoria) |
| `history_delete` | `{ id }` | `()` |
| `history_clear` | `{ host_id? }` | `u64` (filas) |
La búsqueda difusa y el *ranking* (puntuación → `use_count` → recencia) se hacen en el frontend sobre un máximo de 2000 entradas por host.
### Captura y exclusiones
Al recibir `OSC 133;D` (cuando ya se conoce el código de salida) se lee el texto entre `commandStart` y `outputStart` del búfer. Se omite si empieza por espacio, supera 4 KiB, está vacío o coincide con `SECRET_PATTERNS` (`password`, `passwd`, `token`, `secret`, `api[_-]?key`, `Authorization:`, `export\s+\w*(KEY|TOKEN|SECRET)\w*=`). Los hosts locales usan la clave `local`.

## 3. Instant Replay (`src/utils/replay-buffer.ts`)
```ts
class ReplayBuffer { constructor(maxMs = 300_000, maxBytes = 8*1024*1024);
  push(ts: number, chunk: Uint8Array): void;      // descarta lo más antiguo al superar límites
  range(fromTs: number, toTs: number): Uint8Array[]; clear(): void; get span(): [number, number] | null }
```
Se alimenta en el mismo punto donde se escribe en xterm. El visor (`InstantReplayModal.vue`) crea un `Terminal` de solo lectura, y para un instante *t* hace `reset()` y escribe los fragmentos hasta *t* (la reproducción es incremental hacia delante y solo se reinicia al retroceder; el coste está acotado por el límite de 8 MiB, por lo que no se usan puntos de control). Se vacía en `vault_lock`, al cerrar el panel y al salir; no hay escritura a disco.

## 4. Restauración de sesiones
### Persistencia
```sql
CREATE TABLE IF NOT EXISTS session_layout (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  layout_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```
`layout_json` = árbol de pestañas/paneles con `{ kind, host_id?, title, direction, ratio }`; **sin** credenciales, contenido ni comandos. IPC: `session_layout_save(json)`, `session_layout_get()`, `session_layout_clear()`. El frontend guarda con *debounce* de 1 s al cambiar `tabs`.
### Restauración
Tras `vault_unlock`: según `restore_sessions` → diálogo (`ask`), restauración directa (`auto`) o nada. Los paneles se crean en estado *pendiente* y conectan al activarse la pestaña. Se omiten hosts inexistentes y se informa al usuario. Los paneles RDP/VNC se restauran como paneles de escritorio remoto pendientes.

## 5. Addons de xterm (compatibles con xterm 5.5)
| Addon | Versión | Notas |
|---|---|---|
| `@xterm/addon-unicode11` | 0.8.0 | `term.unicode.activeVersion = "11"` |
| `@xterm/addon-clipboard` | 0.1.0 | proveedor propio: solo `write`; `read` devuelve cadena vacía; límite 1 MiB |
| `@xterm/addon-image` | 0.8.0 | `storageLimit` acotado; *spike* de compatibilidad con WebGL |
| `@xterm/addon-ligatures` | 0.9.0 | desactivado por defecto; *spike* con WebGL |
Los addons se cargan según preferencias y se descartan al cambiarlas.

**Resultado del spike (tarea 1.2)**:
- `addon-image` dibuja en sus propios *canvas* superpuestos y es compatible con WebGL y con el renderizador DOM; no requiere respaldo.
- `addon-ligatures` está pensado para entornos con Node.js (resuelve la fuente desde disco con `font-finder`); en Tauri solo funcionan sus ligaduras de respaldo (`fallbackLigatures`). Además depende de *character joiners*, no soportados por WebGL. **Decisión**: si `font_ligatures` está activo se descarga `WebglAddon` y se carga `@xterm/addon-canvas` (renderizador canvas) antes de `addon-ligatures`; al desactivarlo se restaura WebGL.
**Corrección tras prueba real**: la primera decisión (renderizador DOM) era incorrecta. El renderizador DOM de xterm 5.5 fija `letter-spacing` distinto de cero en las filas (medido: `-0.00625px`) y los navegadores desactivan las ligaduras con espaciado de letras, de modo que no se veían. Con el renderizador canvas el texto unido se dibuja como una cadena y el motor aplica las ligaduras de la fuente (verificado en Chrome con JetBrains Mono). La fuente debe estar instalada en el sistema.

## 6. Preferencias
```rust
pub history_enabled: bool,      // true
pub instant_replay: bool,       // true
pub restore_sessions: String,   // "ask" | "auto" | "off", valor inválido => "ask"
pub osc52_clipboard: bool,      // true
pub inline_images: bool,        // true
pub font_ligatures: bool,       // false
```

## 7. Atajos nuevos (registro de `terminal-productivity-quick-wins`)
| Atajo | Acción | Contexto |
|---|---|---|
| `Ctrl+Shift+R` | Repetir comando del bloque | Terminal |
| `Ctrl+Shift+H` | Historial por host | Terminal |
| `Ctrl+Shift+Y` | Instant Replay | Terminal |

## 8. Documentación (obligatoria en este cambio)
`README.md`, `README.es.md` (características y tabla de atajos), `docs/FEATURES_MANUAL.md` (nuevas secciones y cheat sheet), `CHANGELOG.md` y `docs/ROADMAP.md`. La prueba de consistencia de documentación del cambio anterior debe seguir pasando.

## 9. Estrategia de pruebas
Rust: migraciones, cifrado y no aparición del texto en claro en SQLite (`command_history`), deduplicación, exclusiones, borrado en cascada y `session_layout`. Vitest: `BlockTracker` (con markers simulados), `ReplayBuffer` (límites por tiempo y tamaño, `clear`), filtros de exclusión, serialización/restauración del layout (hosts inexistentes, locales, gráficos) y decisión de modo de restauración.
