# Tasks

## 1. Geometría de Paneles y Store de Sesiones (Pinia)

- [x] 1.1 Extender `src/utils/pane-navigation.ts` para exportar el cálculo geométrico plano del árbol (`computePaneLayout(root)`: rectángulos de hojas `LeafPane` y rectángulos/contenedores de divisores `SplitPane`) y verificarlo con pruebas unitarias en `src/utils/pane-navigation.test.ts`.
- [x] 1.2 Actualizar `src/types/session.ts` y `src/stores/sessions.store.ts` para soportar `placement: "before" | "after"` (por defecto `"after"`) en `splitPane` y `dockTabIntoPane`, añadir `setSplitRatio(tabId, splitId, ratio)` con límites `[0.1, 0.9]` y reasignar `activePaneId` al vecino sobreviviente en `closePane`, verificando todos los casos en `src/stores/sessions.test.ts`.

## 2. Renderizado Plano sin Reinicio de Sesiones y UI de División en 4 Direcciones

- [x] 2.1 Refactorizar `src/components/terminal/SplitPaneNode.vue` para renderizar todas las hojas de la pestaña en un único `v-for` plano con `:key="item.pane.id"` y posicionamiento porcentual, manteniendo `defineAsyncComponent` para `RemoteDesktopPane` e incorporando divisores interactivos arrastrables para ajustar `ratio`.
- [x] 2.2 Añadir pruebas de componente en `src/components/terminal/SplitPaneNode.test.ts` que monten un árbol de paneles y verifiquen que dividir múltiples veces (izquierda, derecha, arriba, abajo), acoplar pestañas y cerrar paneles NO desmonta ni vuelve a montar las instancias existentes.
- [x] 2.3 Actualizar el menú contextual de división en `src/components/terminal/TerminalPane.vue` y las traducciones en `src/locales/es.json` y `src/locales/en.json` para permitir elegir cualquiera de las 4 direcciones (Izquierda, Derecha, Arriba, Abajo), verificando integridad de claves con `src/locales/locales.test.ts`.

## 3. Verificación Integral y Validación OpenSpec

- [x] 3.1 Ejecutar la suite completa de pruebas frontend (`pnpm test`), verificación estricta de tipos y compilación (`pnpm build`) y validación formal de especificaciones (`openspec validate`), confirmando cero errores.

## Workflow follow-up

- Archivar el cambio con `/opsx-archive` una vez revisada y aprobada la implementación por el usuario.
