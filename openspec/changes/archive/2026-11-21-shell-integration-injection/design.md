## Context

- `PtySessionManager::spawn_local` (`src-tauri/src/pty/mod.rs`) arranca el shell con `CommandBuilder`, siempre con `-l` en Unix y `TERM`/`COLORTERM` fijados.
- El frontend solo registra historial y bloques al recibir OSC 133 (`TerminalPane.vue`, `BlockTracker`). `history_record` exige la bóveda desbloqueada (`get_active_vault_key` → `Locked`).
- Es el patrón que usan VS Code, WezTerm y kitty: scripts propios que se cargan sin tocar los ficheros del usuario.

## Decisions

### Scripts y ubicación
- Tres scripts embebidos con `include_str!` desde `src-tauri/resources/shell-integration/` (`zsh/`, `bash.sh`, `fish.fish`).
- Un módulo `pty/integration.rs` los escribe una vez por ejecución en `<app cache dir>/shell-integration/<versión>/` (directorio `0700`, ficheros `0600`). Si ya existen con el mismo contenido no se reescriben. Cualquier error de E/S devuelve «sin integración».
- El shell se detecta por el nombre del ejecutable (`bash`, `zsh`, `fish`), incluido el de `default_shell`. Cualquier otro (o Windows) no recibe integración.

### Cómo se arranca cada shell (sin tocar los ficheros del usuario)
- **zsh**: `ZDOTDIR` apunta a un directorio temporal con proxies de `.zshenv`, `.zprofile`, `.zshrc` y `.zlogin`. Cada proxy carga el fichero homónimo del usuario (desde `NEXUSTERM_USER_ZDOTDIR`, que guarda su `ZDOTDIR` original o `$HOME`). Al final del proxy de `.zshrc` se instalan los hooks y `ZDOTDIR` se restaura al valor del usuario.
- **bash**: se sustituye `-l` por `--init-file <script>`; el script reproduce la carga de login (`/etc/profile` y el primero de `~/.bash_profile`, `~/.bash_login`, `~/.profile`) y luego `~/.bashrc` si procede, e instala los hooks al final (`PROMPT_COMMAND` y `PS0`/`PS1`).
- **fish**: se mantiene `-l` y se añade `--init-command 'source <script>'`, que se ejecuta tras la configuración del usuario.
- Las marcas son `OSC 133;A`, `;B`, `;C` y `;D;<código>`, con `ST` = `BEL`. El prompt de zsh/bash se envuelve con `B` de modo que el marcador del fin del prompt (`commandStart`) quede donde el `BlockTracker` lo espera.

### Evitar marcas duplicadas
- Los scripts no hacen nada si `NEXUSTERM_SHELL_INTEGRATION` ya está definida, y fish solo se instrumenta si `$version` es menor que 4 (las versiones nuevas emiten OSC 133 de forma nativa).
- Se exporta `NEXUSTERM_SHELL_INTEGRATION=1` al shell para que el usuario pueda detectarlo y condicionar su propia configuración.
- El ajuste `shell_integration` es el escape para quien ya tiene su propia integración.

### Ajuste
- `shell_integration: bool` (por defecto `true`) en `settings.rs` con `#[serde(default)]`, en el panel de terminal. `open_local_pty` lee el ajuste y el directorio de caché desde el estado de Tauri (`AppHandle`).
- La lógica se aísla en una función pura `integration_plan(shell, dir) -> Option<Plan { args, env }>`, fácil de probar sin crear un PTY.

### Historial con la bóveda bloqueada
- En `history.store.ts`, `record()` aplica primero `shouldRecordCommand`. Si `history_record` falla porque la bóveda está bloqueada, el comando se añade a una cola **en memoria** (máx. 200, se descarta el más antiguo) con host, texto, código de salida y marca de tiempo.
- Al desbloquear (observando `vault.isUnlocked`) se vuelca la cola en orden con `history_record` y se vacía. Al bloquear no se persiste nada y `reset()` no borra la cola pendiente.
- `load()` con la bóveda bloqueada devuelve las entradas pendientes de ese host como `HistoryEntry` sintéticas, de modo que el selector de historial y el popup de autocompletado las ofrecen.
- La cola nunca se serializa (regla 1 de `AGENTS.md`).

## Risks

- **Configuraciones que sobreescriben `PROMPT_COMMAND` o el prompt** después de nuestros hooks: se instalan al final, pero un framework que los reasigne tarde puede romperlos. El ajuste permite desactivarlo.
- **`--init-file` cambia el flujo de arranque de bash**: hay que replicar fielmente la carga de login. Se cubre con una prueba que ejecuta bash si está instalado.
- **`ZDOTDIR` visible para el usuario** mientras se cargan los proxies: se restaura antes del primer prompt.
- **Usuarios con integración propia** pueden ver marcas duplicadas si el aviso `NEXUSTERM_SHELL_INTEGRATION` no les basta; deben desactivar el ajuste.
- **Escritura en el directorio de caché**: se degrada sin integración, no falla el arranque de la terminal.
