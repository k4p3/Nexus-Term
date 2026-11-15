export interface CpuMetrics {
  total_usage_percent: number;
  cores_count: number;
}

export interface MemoryMetrics {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  available_bytes: number;
  usage_percent: number;
  swap_total_bytes: number;
  swap_used_bytes: number;
}

export interface DiskMetrics {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  usage_percent: number;
  mount_point: string;
}

export interface NetworkMetrics {
  rx_bytes_per_sec: number;
  tx_bytes_per_sec: number;
  total_rx_bytes: number;
  total_tx_bytes: number;
}

export interface SystemTelemetrySnapshot {
  timestamp_ms: number;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  uptime_seconds: number;
  load_avg: [number, number, number];
}
