# Tasks: Live Telemetry & System Monitoring

## 1. Backend Rust (Módulo Telemetría y Streaming)

- [x] 1.1 Crear el módulo `src-tauri/src/telemetry/` con sus structs de datos `SystemTelemetrySnapshot`, `CpuMetrics`, `MemoryMetrics`, `DiskMetrics`, `NetworkMetrics` en `models.rs`.
- [x] 1.2 Implementar el parser puro y libre de efectos secundarios en `src-tauri/src/telemetry/parser.rs` con pruebas unitarias exhaustivas para `/proc/stat`, `/proc/meminfo`, `/proc/net/dev`, `df` y `uptime`.
- [x] 1.3 Implementar el recolector sobre sesión SSH (`collector.rs`) que ejecuta el comando empaquetado optimizado mediante `russh` y calcula los deltas de CPU y red.
- [x] 1.4 Implementar los comandos Tauri IPC (`fetch_telemetry_snapshot`, `start_telemetry_stream`, `stop_telemetry_stream`) en `commands.rs` con control de ciclo de vida en Tokio.
- [x] 1.5 Registrar el módulo y los comandos en `src-tauri/src/lib.rs` y verificar compilación limpia con `cargo test`.

## 2. Tipos de Datos y Servicios en el Frontend

- [x] 2.1 Crear `src/types/telemetry.ts` con las interfaces TypeScript equivalentes a los structs de Rust.
- [x] 2.2 Implementar el cliente IPC en `src/services/telemetry.service.ts` con suscripción a canales `tauri::ipc::Channel`.
- [x] 2.3 Crear la tienda Pinia `src/stores/telemetry.store.ts` para gestionar streams activos, retención de historial de últimos 30 puntos para sparklines y configuración de intervalos.
- [x] 2.4 Escribir pruebas unitarias en Vitest para `src/stores/telemetry.test.ts`.

## 3. Componentes de Interfaz de Usuario (UI)

- [x] 3.1 Diseñar e implementar el componente `src/components/terminal/TelemetryBar.vue` con barras de progreso estilizadas, indicadores de red (↑/↓), load average, uptime y selectores de intervalo.
- [x] 3.2 Integrar el conmutador de telemetría en la cabecera de `src/components/terminal/TerminalPane.vue` para activarlo/desactivarlo en paneles remotos SSH.
- [x] 3.3 Garantizar que el componente maneje estados de carga, desconexión y alertas de color (verde < 70%, ámbar 70-85%, rojo > 85%).

## 4. Verificación, Testing y Validación

- [x] 4.1 Ejecutar suite completa de pruebas de backend (`cargo test`).
- [x] 4.2 Ejecutar suite completa de pruebas de frontend (`pnpm test` / Vitest).
- [x] 4.3 Comprobar tipos TypeScript estrictos (`vue-tsc --noEmit`) y compilar la aplicación (`vite build`).
