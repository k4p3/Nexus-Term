## Context

Los atajos viven en un registro único (`src/utils/shortcuts.ts`) consumido por el manejador global de `App.vue`, la paleta y la hoja de atajos. La acción «nueva terminal local» ya existe en `App.vue` (`handleOpenLocalPty`, que llama a `sessionsStore.createTab(t('terminal.newLocal'))`).

## Decisions

- **Contexto `global`**: el atajo debe funcionar con cualquier foco, incluso sin terminal activa. `matchShortcut(e, ["global", "workspace"])` ya se evalúa en `handleGlobalKeyDown`.
- **Combo** `{ key: "t", ctrl: true, shift: true }`, grupo `navigation`. No colisiona con ningún atajo existente (`Ctrl+T` simple no se usa y no se toca, para no interferir con readline/shells).
- **Handler**: nuevo `case "terminal.newLocal"` en `handleGlobalKeyDown` que reutiliza `handleOpenLocalPty()`.
- **i18n**: clave `shortcuts.terminal.newLocal` («Nueva terminal local» / «New local terminal»).
- Sin cambios en contratos IPC ni en SQLite.

## Risks

- Algunos entornos Linux (WebKitGTK) podrían capturar `Ctrl+Shift+T`; se mitiga con `e.preventDefault()` ya presente en el manejador.
