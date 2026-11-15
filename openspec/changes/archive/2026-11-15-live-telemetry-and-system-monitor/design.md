# Design: Live Telemetry & System Monitoring

## Context

NexusTerm multiplexa conexiones SSH permitiendo que un solo socket TCP transporte simultáneamente el canal interactivo PTY (xterm.js), canales SFTP y reenvío de puertos. En la operación diaria con servidores remotos, resulta de vital importancia conocer el estado de salud y carga de la máquina (si la CPU está al 100%, si la RAM está a punto de agotarse o si la red o disco están saturados).

## Goals / Non-Goals

**Goals:**
- Recolectar métricas clave (CPU, Memoria, Disco, Red, Load Average, Uptime) de forma no invasiva sobre el canal SSH existente.
- Cero agentes, cero dependencias y cero instalación en el servidor remoto.
- Transmisión continua y reactiva hacia el frontend mediante `tauri::ipc::Channel<SystemTelemetrySnapshot>`.
- Componente `TelemetryBar.vue` integrado en la cabecera de cada panel de terminal remota con mini sparklines o barras de color.
- Consumo mínimo de CPU en cliente y servidor remoto (comando combinado empaquetado en una sola llamada `sh -c '...'`).

**Non-Goals:**
- No es una suite de observabilidad histórica ni reemplazo de Prometheus/Grafana (no almacena métricas por semanas en base de datos; retiene un buffer circular en memoria de los últimos 20-30 puntos para la sesión activa).
- No recopila telemetría de máquinas locales (la terminal local ya tiene acceso directo a herramientas del sistema).

## Architecture & Data Flow

```text
[Servidor SSH Remoto]
        │
        │ russh::Channel::exec (sh -c 'cat /proc/stat; echo "---"; cat /proc/meminfo; ...')
        ▼
[Rust Backend: TelemetryCollector & Parser]
        │
        │ Procesa buffers de texto -> SystemTelemetrySnapshot
        │
        ▼ tauri::ipc::Channel<SystemTelemetrySnapshot>
[Frontend: TelemetryStore (Pinia)]
        │
        │ Buffer circular de métricas (últimos 30 puntos)
        │
        ▼
[TelemetryBar.vue en TerminalPane.vue]
  [CPU: 24% ■□□□] [RAM: 3.2/8.0 GB (40%)] [Disco: 45%] [Net: ↑ 12 kB/s ↓ 140 kB/s] [Uptime: 14d]
```

## Decisions

### Decisión 1: Comando Combinado vs Múltiples Canales Exec
- **Elección**: Ejecutar un único script corto de shell que emite todas las métricas separadas por delimitadores reconocibles (ej. `__NEXUS_STAT__`, `__NEXUS_MEM__`, `__NEXUS_NET__`, `__NEXUS_DF__`, `__NEXUS_LOAD__`).
- **Razón**: Ejecutar 5 comandos independientes cada 2 segundos multiplicaría por 5 la sobrecarga del protocolo SSH y el handshake de canales. Un solo `exec` empaquetado tarda < 20ms y consume milisegundos de CPU en el servidor.

### Decisión 2: Cálculo Diferencial para CPU y Red
- **Implementación**:
  - **CPU**: Se registran los ticks de `/proc/stat` (`user`, `nice`, `system`, `idle`, `iowait`, `irq`, `softirq`). La utilización se calcula como: `100 * (delta_total - delta_idle) / delta_total`.
  - **Red**: Se registran los bytes de recepción y transmisión en `/proc/net/dev`. La tasa por segundo es: `delta_bytes / delta_tiempo_segundos`.
- **Razón**: Da una precisión idéntica a `top` o `nload` sin necesidad de ejecutar procesos pesados.

### Decisión 3: Streaming Asíncrono Tokio + Channel Tauri
- **Implementación**:
  - El backend mantiene un mapa de `Arc<AtomicBool>` o canales de cancelación `tokio::sync::oneshot::Sender<()>` indexados por `stream_id`.
  - Un loop en Tokio ejecuta la recolección periódica y envía el snapshot mediante `channel.send(snapshot)`.
  - Cuando el frontend llama a `stop_telemetry_stream(stream_id)` o la sesión se destruye, la tarea Tokio se cancela de inmediato.

## Models & Interfaces

### Backend Structs (`src-tauri/src/telemetry/models.rs`)
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemTelemetrySnapshot {
    pub timestamp_ms: u64,
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub disk: DiskMetrics,
    pub network: NetworkMetrics,
    pub uptime_seconds: u64,
    pub load_avg: (f32, f32, f32),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuMetrics {
    pub total_usage_percent: f32,
    pub cores_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f32,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub usage_percent: f32,
    pub mount_point: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub rx_bytes_per_sec: f64,
    pub tx_bytes_per_sec: f64,
    pub total_rx_bytes: u64,
    pub total_tx_bytes: u64,
}
```

## Risks & Mitigations

- **[Riesgo] Servidores con `/proc` no accesible o sistemas BSD/macOS**:
  - *Mitigación*: El parser detecta delimitadores ausentes o líneas no reconocidas y rellena con valores predeterminados (0.0 o "N/A"), manteniendo la aplicación estable y sin crasheos.
- **[Riesgo] Sobrecarga de red por streaming muy frecuente**:
  - *Mitigación*: El intervalo mínimo configurable se fija en 1 segundo (por defecto 2 segundos). La carga del snapshot serializado en JSON es inferior a 400 bytes por paquete.
