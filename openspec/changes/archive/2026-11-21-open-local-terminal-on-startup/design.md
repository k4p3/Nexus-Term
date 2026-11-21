## Context

`useSessionRestore.ts` abre la terminal inicial con `openInitialLocalTab()`, protegida por `lazyStart` (solo true si el arranque fue sin desbloquear la bóveda). En el flujo «pedir contraseña al iniciar», `startup()` sale antes y `onUnlocked()` no abre ninguna.

## Decisions

- `openInitialLocalTab()` pasa a abrir la local cuando `sessions.tabs.length === 0`, sin depender de `lazyStart` (se conserva `initialTabId` para que no cuente como pestaña del usuario al decidir la restauración).
- `onUnlocked()` la invoca tras `applyRestore`/ausencia de layout, antes de marcar `startupResolved`. La guarda `startupResolved` existente evita reabrir al bloquear/desbloquear.
- Con `action === "auto"` y layout válido la restauración puebla las pestañas, por lo que la guarda de vacío evita duplicados.
- Sin cambios de IPC, SQLite ni ajustes.

## Risks

- Si `restoreLayout` omite todos los hosts (borrados), quedan 0 pestañas y se abre la local: comportamiento deseado.
