# Tasks: System Tray Integration & Background Persistence

## 1. Backend Rust (Dependencias y Configuración)

- [x] 1.1 Habilitar la característica `tray-icon` en la dependencia `tauri` en `src-tauri/Cargo.toml`.
- [x] 1.2 Extender el struct `AppSettings` en `src-tauri/src/settings.rs` con el campo `close_to_tray: bool` (default `true`) y actualizar pruebas unitarias.
- [x] 1.3 Construir el `TrayIcon` con menú nativo ("Mostrar NexusTerm" y "Salir") y tooltip en `src-tauri/src/lib.rs`.
- [x] 1.4 Manejar el evento de clic en el ícono de la bandeja para alternar visibilidad de la ventana.
- [x] 1.5 Interceptar el evento `WindowEvent::CloseRequested` para ocultar la ventana a la bandeja cuando `close_to_tray` esté activo.

## 2. Frontend y Ajustes de Usuario

- [x] 2.1 Actualizar la interfaz TypeScript `AppSettings` en `src/types/settings.ts` con `close_to_tray: boolean`.
- [x] 2.2 Agregar el interruptor "Minimizar a la bandeja del sistema al cerrar" en la pestaña General de `src/components/settings/SettingsModal.vue`.

## 3. Verificación, Pruebas y Compilación

- [x] 3.1 Ejecutar suite de pruebas de Rust (`cargo test`).
- [x] 3.2 Ejecutar suite de pruebas de frontend (`vitest run`).
- [x] 3.3 Verificar tipado estricto con `vue-tsc --noEmit`.
- [x] 3.4 Compilar paquetes de release de producción (`tauri build`).
- [x] 3.5 Actualizar `CHANGELOG.md` y sincronizar commit y tag `v0.1.0-beta` en GitHub.
