use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SystemTelemetrySnapshot {
    pub timestamp_ms: u64,
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub disk: DiskMetrics,
    pub network: NetworkMetrics,
    pub uptime_seconds: u64,
    pub load_avg: (f32, f32, f32),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CpuMetrics {
    pub total_usage_percent: f32,
    pub cores_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MemoryMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f32,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiskMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub usage_percent: f32,
    pub mount_point: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NetworkMetrics {
    pub rx_bytes_per_sec: f64,
    pub tx_bytes_per_sec: f64,
    pub total_rx_bytes: u64,
    pub total_tx_bytes: u64,
}

#[derive(Debug, Clone, Default)]
pub struct PreviousMetricsState {
    pub timestamp_ms: u64,
    pub cpu_total_ticks: u64,
    pub cpu_idle_ticks: u64,
    pub total_rx_bytes: u64,
    pub total_tx_bytes: u64,
}
