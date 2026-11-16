# Tareas: performance-memory-optimization

- [x] 1. Configuración de Compilación y Optimización de Binario (Rust)
  - [x] 1.1 Agregar perfil `[profile.release]` en `src-tauri/Cargo.toml` con `opt-level = 3`, `lto = true`, `codegen-units = 1`, `panic = "abort"` y `strip = true`.
  - [x] 1.2 Ejecutar `cargo check` y `cargo test` en `src-tauri/` para verificar que la configuración sea válida y los tests sigan pasando.

- [x] 2. Carga Asíncrona (Lazy Loading) de Componentes en Frontend (Vue 3)
  - [x] 2.1 Convertir componentes modales y paneles secundarios en [src/App.vue](file:///data/Proyectos/personal/nexus-term/src/App.vue) a `defineAsyncComponent`.
  - [x] 2.2 Mantener como carga síncrona inmediata únicamente los componentes de boot esenciales (`VaultUnlockScreen`, `TerminalWorkspace`, `HostTreeSidebar`).
  - [x] 2.3 Optimizar instanciación de `LigaturesAddon` en [src/components/terminal/TerminalPane.vue](file:///data/Proyectos/personal/nexus-term/src/components/terminal/TerminalPane.vue) bajo demanda de la preferencia activa.

- [x] 3. Optimización de Bundle y Chunks en Vite
  - [x] 3.1 Configurar `manualChunks` en [vite.config.ts](file:///data/Proyectos/personal/nexus-term/vite.config.ts) para segmentar `@xterm/*`, `lucide-vue-next` y dependencias del núcleo.
  - [x] 3.2 Verificar compilación con `pnpm build` (`vue-tsc --noEmit && vite build`) comprobando que los chunks generados en `dist/` estén divididos apropiadamente.

- [x] 4. Verificación y Pruebas Automatizadas
  - [x] 4.1 Ejecutar suite completa de tests de frontend (`pnpm test`).
  - [x] 4.2 Ejecutar suite completa de tests de backend (`cargo test`).
  - [x] 4.3 Comprobar reducción en tamaño de artefactos y validar ausencia de regresiones visuales o de navegación por teclado.

