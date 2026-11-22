## 1. Backend (Rust)

- [x] 1.1 Añadir `shell_integration` (por defecto `true`, `#[serde(default)]`) en `src-tauri/src/settings.rs`, con su prueba de compatibilidad con ajustes antiguos.
- [x] 1.2 Crear los scripts `src-tauri/resources/shell-integration/{zsh/.zshenv,.zprofile,.zshrc, bash.sh, fish.fish}` con OSC 133 y guarda `NEXUSTERM_SHELL_INTEGRATION`.
- [x] 1.3 Crear `src-tauri/src/pty/integration.rs`: detección de shell, materialización en el directorio de caché y función pura `integration_plan`.
- [x] 1.4 Aplicar el plan en `spawn_local` (args y entorno) sin romper el resto del arranque; `open_local_pty` lee el ajuste y el directorio de caché.
- [x] 1.5 Pruebas Rust: detección de shell, plan por shell, shell no soportado, fallo de E/S sin integración, scripts materializados con el contenido esperado y, si hay `bash`, ejecución real que emite `A`, `B`, `C`, `D;0`.

## 2. Frontend

- [x] 2.1 Añadir el ajuste a `src/types/settings.ts`, `settings.store.ts` y al panel de ajustes de terminal (carga diferida), con textos en `es.json` y `en.json`.
- [x] 2.2 Cola en memoria en `history.store.ts`: encolar con la bóveda bloqueada, tope de 200, volcado ordenado al desbloquear, entradas pendientes en `load()`.
- [x] 2.3 Pruebas del store: encolado, filtros de privacidad, tope, volcado, historial desactivado y que nada se persiste.

## 3. Documentación

- [x] 3.1 Actualizar `docs/FEATURES_MANUAL.md` (§4.1), `docs/MANUAL_TEST_CHECKLIST.md`, `README.md`, `README.es.md`, `CHANGELOG.md` y las guías del sitio.

## 4. Verificación

- [x] 4.1 Ejecutar `cd src-tauri && cargo test`, `pnpm test`, `vue-tsc --noEmit` y `vite build` con cero errores.

## 5. Cierre

- [x] 5.1 Ejecutar `openspec validate` y archivar el cambio.
