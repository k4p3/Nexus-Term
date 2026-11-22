## Why

Los bloques de comandos, las notificaciones de comandos largos, el historial por host y el autocompletado dependen de las marcas **OSC 133** del shell. NexusTerm no las inyecta: hoy el usuario tendría que editar su `.zshrc`/`.bashrc` a mano, así que en una instalación normal el historial nunca se llena (se comprobó con el popup de `autocomplete-popup`, que solo mostraba snippets).

Además, el historial va cifrado con la clave de la bóveda. Como la app arranca con una terminal local sin pedir la contraseña, todo lo ejecutado antes de desbloquear se pierde en silencio.

Es el segundo cambio de la línea de autocompletado (`autocomplete-popup` → `shell-integration-injection` → `autocomplete-inline-suggestion`).

## What Changes

- Al abrir un **PTY local** en bash, zsh o fish, NexusTerm lo arranca con una integración que emite OSC 133 (`A`, `B`, `C`, `D;<exit>`), **sin modificar los ficheros del usuario** (`ZDOTDIR` temporal para zsh, `--init-file` para bash, `--init-command` para fish). Los ficheros del usuario se cargan igual que siempre.
- Los scripts van embebidos en el binario y se materializan en el directorio de caché de la aplicación al arrancar.
- Nuevo ajuste `shell_integration` (por defecto activado) en *Ajustes → Terminal*, para quien ya tenga su propia integración o no la quiera.
- El script no hace nada si el shell ya emite OSC 133 (fish ≥ 4, o la integración del propio usuario), para evitar marcas duplicadas.
- **Historial con la bóveda bloqueada**: los comandos terminados mientras está bloqueada se guardan solo en memoria (con tope) y se vuelcan a la bóveda cifrada al desbloquear; nunca se escriben a disco sin cifrar. Mientras tanto se ofrecen en el historial y el autocompletado del mismo host.
- Fuera de alcance: SSH/remoto (lo sigue configurando el usuario), PowerShell/WSL y Windows en general, y shells distintos de bash/zsh/fish.
- Sin dependencias nuevas (`include_str!` y `std::fs`; no aplica verificación de licencias).

## Capabilities

### New Capabilities
- `shell-integration`: inyección de OSC 133 en terminales locales y registro del historial con la bóveda bloqueada.

### Modified Capabilities
- `app-settings`: nuevo ajuste `shell_integration`.

## Impact

- Rust: `src-tauri/src/pty/mod.rs` (nuevo submódulo `pty/integration.rs`, scripts en `src-tauri/resources/shell-integration/`), `src-tauri/src/settings.rs`, `src-tauri/src/lib.rs` (`open_local_pty` recibe el estado de ajustes).
- Frontend: `src/stores/history.store.ts` y su prueba, `src/stores/settings.store.ts`, `src/types/settings.ts`, el panel de ajustes de terminal, `src/locales/{es,en}.json`, `src/services/session.service.ts` si cambia la firma.
- Documentación: `docs/FEATURES_MANUAL.md` (§4.1), `docs/MANUAL_TEST_CHECKLIST.md`, `README.md`, `README.es.md`, `CHANGELOG.md`, sitio (`site/*/guide|guia`).
