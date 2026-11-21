## Context

El registro único de atajos (`src/utils/shortcuts.ts`) alimenta el manejador global de `App.vue`, la paleta y la hoja de atajos. Las pestañas viven en `sessions.store.ts` (`tabs`, `activeTabId`).

## Decisions

- **Combos** (contexto `global`, grupo `navigation`): `app.nextTab` = `Ctrl+Tab`, `app.nextTabAlt` = `Ctrl+PageDown`, `app.prevTab` = `Ctrl+Shift+Tab`, `app.prevTabAlt` = `Ctrl+PageUp`. Se usa `code` (`Tab`, `PageDown`, `PageUp`) porque son teclas no imprimibles. Son los mismos que usan Konsole, Tabby y los navegadores.
- La prueba «sin Ctrl+tecla simple» (reservado al shell) se amplía con una lista explícita para `Ctrl+Tab` y `Ctrl+PageUp/PageDown`: no son letras ni las usa el shell. `Ctrl+Shift+Tab` ya queda fuera de la regla por llevar Shift.
- **Store**: nueva acción `activateAdjacentTab(delta: 1 | -1)` que calcula el índice cíclico y fija `activeTabId`; sin efecto con menos de 2 pestañas.
- **Handler**: `case` en `handleGlobalKeyDown` para los cuatro ids (los alternativos comparten la acción, como `terminal.splitHAlt`).
- **Documentación**: `shortcuts.docs.test.ts` y `site.docs.test.ts` exigen cada atajo en READMEs, manual y sitio; la variante alternativa se documenta en la misma fila (`DOCUMENTED_AS`).
- Sin cambios de IPC, SQLite ni ajustes.

## Risks

- `Ctrl+Tab` puede ser interceptado por el webview o el gestor de ventanas en algunos entornos; por eso existe el par `Ctrl+PageUp/PageDown`.
