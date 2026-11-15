# Proposal: Telemetría Ligera en Vivo y Monitor de Recursos Remotos sobre SSH

## Why

Al operar servidores remotos mediante SSH, administradores de sistemas y DevOps frecuentemente necesitan monitorear el consumo de CPU, memoria RAM, almacenamiento en disco y tráfico de red sin tener que abrir sesiones separadas, sin saturar la terminal interactiva con herramientas invasivas en bucle (como `htop` o `glances`), y sin instalar agentes externos o demonios privativos en los servidores remotos.

NexusTerm fue concebido con arquitectura de **multiplexación de canales SSH** sobre un único socket TCP autenticado. Aprovechar esta conexión para habilitar un canal de telemetría ligero y no invasivo permite a los usuarios visualizar métricas en tiempo real en la interfaz (CPU, RAM, Disco, Red, Uptime y Load Average) integradas directamente en cada panel de terminal remota con consumo mínimo de recursos y cero configuración en el servidor.

## What Changes

- **Backend Rust (`src-tauri/src/telemetry/`)**:
  - Módulo nativo de recolección y análisis de telemetría remota.
  - Ejecución de comandos no invasivos (`exec` ligero sobre el canal SSH de `russh`) leyendo archivos pseudo-sistema estándar de Linux:
    - `/proc/stat` y `/proc/loadavg` para uso de procesador (porcentajes de usuario, sistema, idle e iowait) y carga media.
    - `/proc/meminfo` para memoria total, disponible, libre, buffers, cache y swap.
    - `/proc/net/dev` para bytes recibidos y transmitidos entre intervalos para calcular tasa kB/s y MB/s.
    - `df -k -P /` para capacidad total, usada, disponible y porcentaje de la partición raíz o discos principales.
    - `uptime -p` / `/proc/uptime` para tiempo de actividad del sistema.
  - Parser robusto con tolerancia a fallos: fallback elegante si el sistema remoto no es Linux estándar o cuenta con permisos restringidos.
  - Comandos Tauri IPC con soporte de streaming reactivo (`tauri::ipc::Channel<SystemTelemetrySnapshot>`):
    - `fetch_telemetry_snapshot`: Obtención puntual bajo demanda.
    - `start_telemetry_stream`: Flujo periódico continuo con intervalo configurable (1s, 2s, 5s, 10s).
    - `stop_telemetry_stream`: Cancelación del flujo periódico y liberación de recursos.
- **Frontend Vue 3 + TypeScript**:
  - Tipos e interfaces en `src/types/telemetry.ts` (`SystemTelemetrySnapshot`, `CpuMetrics`, `MemoryMetrics`, `DiskMetrics`, `NetworkMetrics`).
  - Cliente IPC `src/services/telemetry.service.ts`.
  - Store Pinia `src/stores/telemetry.store.ts` para gestionar streams activos por sesión, historial de métricas para sparklines, intervalo y estado de visibilidad.
  - Componente `src/components/terminal/TelemetryBar.vue`:
    - Barra horizontal compacta e interactiva integrada en cada panel de terminal conectado a un host remoto.
    - Medidores de estado con codificación de colores según umbrales de severidad (verde normal, ámbar advertencia > 70%, rojo crítico > 85%).
    - Indicador de velocidad de red en tiempo real (↑ subida / ↓ bajada).
    - Selector de intervalo y botón de pausa/reanudación.
  - Integración en `src/components/terminal/TerminalPane.vue`:
    - Botón en la cabecera del panel para conmutar la barra de telemetría (`TelemetryBar`).
- **Pruebas Automatizadas y Licencias**:
  - Pruebas unitarias en Rust para los parsers de `/proc/stat`, `/proc/meminfo`, `/proc/net/dev` y `df`.
  - Pruebas unitarias en Vitest para `telemetry.store.ts`.
  - 100% Rust estándar y crates compatibles con GNU GPLv3.

## Capabilities

### New Capabilities
- `live-telemetry`: Recolección periódica no invasiva de telemetría de sistema (CPU, RAM, Disco, Red, Load, Uptime) sobre canales multiplexados de SSH y visualización reactiva en barra de herramientas de terminal.

### Modified Capabilities
<!-- Ninguna capacidad existente modifica sus requisitos normativos -->

## Impact

- **Backend (Rust)**:
  - Creación del módulo `src-tauri/src/telemetry/` (`mod.rs`, `models.rs`, `collector.rs`, `parser.rs`, `commands.rs`).
  - Registro de comandos Tauri en `src-tauri/src/lib.rs`.
- **Frontend (Vue 3 / TypeScript)**:
  - Creación de `src/types/telemetry.ts`, `src/services/telemetry.service.ts`, `src/stores/telemetry.store.ts`.
  - Creación de `src/components/terminal/TelemetryBar.vue`.
  - Edición de `src/components/terminal/TerminalPane.vue` para alternar la barra de telemetría.
