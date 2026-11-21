## Why

La app ya abre una terminal local inicial cuando arranca sin pedir contraseña, pero no cuando «Pedir contraseña al iniciar» está activo: tras el desbloqueo el espacio de trabajo puede quedar vacío. El usuario espera empezar siempre con una terminal utilizable.

## What Changes

- Al terminar de resolver el inicio (arranque normal, desbloqueo inicial, restauración aceptada o descartada), si no hay ninguna pestaña abierta se abre una terminal local.
- Si se restauran pestañas guardadas, NO se añade otra local.
- Sin ajuste nuevo, sin cambios en Rust, sin dependencias nuevas (no aplica verificación de licencias).

## Capabilities

### New Capabilities
<!-- Ninguna -->

### Modified Capabilities
- `terminal-multiplexer`: garantía de pestaña inicial.

## Impact

- `src/composables/useSessionRestore.ts` y su prueba.
