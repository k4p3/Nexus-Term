# Propuesta: performance-memory-optimization

## Motivación
Al iniciar NexusTerm en Linux (Manjaro KDE Plasma), el consumo de memoria RAM medido en el monitor del sistema ronda los ~260 MB y el ejecutable en modo desarrollo alcanza ~197-260 MB en disco.
Aunque NexusTerm incluye características avanzadas que justifican un mayor consumo que una terminal básica (bóveda cifrada, cliente SFTP, túneles SSH, monitor de telemetría y renderizador WebGL), una optimización en el arranque permitirá:
1. Reducir la huella de memoria en reposo al iniciar la aplicación (heap de JavaScriptCore y buffers de WebKitGTK).
2. Diferir la carga de módulos pesados que el usuario no utiliza inmediatamente (SFTP, túneles, snippets, modales de configuración).
3. Configurar perfiles de compilación de Rust (`profile.release`) para generar ejecutables ligeros (< 25 MB) con LTO y stripping de símbolos.
4. Mejorar los tiempos de carga inicial y reactividad del frontend.

## Capacidades Afectadas
- `specs/runtime-performance/spec.md`: Nueva capacidad con requisitos normativos sobre consumo de memoria, carga asíncrona de componentes y perfil de compilación.

## Alcance (In Scope)
- **Frontend (Vue 3 / Vite)**:
  - Adopción de `defineAsyncComponent` en [src/App.vue](file:///data/Proyectos/personal/nexus-term/src/App.vue) para modales y componentes secundarios (`SettingsModal`, `SnippetDrawer`, `PortForwardManager`, `SftpSidebar`, `TransferQueue`, `ShortcutsModal`, `RestoreSessionsModal`, `TerminalCommandPalette`).
  - Carga diferida o bajo demanda de addons opcionales de `@xterm/xterm` en [src/components/terminal/TerminalPane.vue](file:///data/Proyectos/personal/nexus-term/src/components/terminal/TerminalPane.vue) (`LigaturesAddon`, `ImageAddon`).
  - Configuración de fragmentación de código (*code splitting* y chunks manuales de Rollup) en [vite.config.ts](file:///data/Proyectos/personal/nexus-term/vite.config.ts).
- **Backend (Rust / Tauri)**:
  - Configuración del perfil de lanzamiento `[profile.release]` en [src-tauri/Cargo.toml](file:///data/Proyectos/personal/nexus-term/src-tauri/Cargo.toml) (`opt-level = 3`, `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`).
  - Revisión y optimización de inicialización de hilos y canales en el arranque.
- **Pruebas y Verificación**:
  - Pruebas unitarias de frontend (`pnpm test`) y backend (`cargo test`).
  - Verificación de tipos estricta (`vue-tsc --noEmit`).
  - Medición comparativa de memoria RAM y tamaño de archivo antes y después de los cambios.

## Fuera de Alcance (Out of Scope)
- Reemplazar WebKitGTK por otro motor web en Linux (está sujeto a la arquitectura oficial de Tauri v2).
- Reescribir la terminal en componentes nativos GTK o Skia (se mantiene la arquitectura `xterm.js` + WebGL).
