use super::models::{
    CpuMetrics, DiskMetrics, MemoryMetrics, NetworkMetrics, PreviousMetricsState,
    SystemTelemetrySnapshot,
};

pub const TELEMETRY_SHELL_COMMAND: &str = r#"sh -c '
echo "===STAT==="
grep "^cpu" /proc/stat 2>/dev/null || true
echo "===MEM==="
grep -E "^(MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree):" /proc/meminfo 2>/dev/null || true
echo "===NET==="
grep -v "lo:" /proc/net/dev 2>/dev/null || true
echo "===DF==="
df -k -P / 2>/dev/null || true
echo "===LOAD==="
cat /proc/loadavg 2>/dev/null || true
echo "===UPTIME==="
cat /proc/uptime 2>/dev/null || true
'"#;

pub fn parse_telemetry_output(
    raw: &str,
    prev_state: &Option<PreviousMetricsState>,
    now_ms: u64,
) -> (SystemTelemetrySnapshot, PreviousMetricsState) {
    let mut stat_section = String::new();
    let mut mem_section = String::new();
    let mut net_section = String::new();
    let mut df_section = String::new();
    let mut load_section = String::new();
    let mut uptime_section = String::new();

    let mut current_section = "";

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed == "===STAT===" {
            current_section = "stat";
            continue;
        } else if trimmed == "===MEM===" {
            current_section = "mem";
            continue;
        } else if trimmed == "===NET===" {
            current_section = "net";
            continue;
        } else if trimmed == "===DF===" {
            current_section = "df";
            continue;
        } else if trimmed == "===LOAD===" {
            current_section = "load";
            continue;
        } else if trimmed == "===UPTIME===" {
            current_section = "uptime";
            continue;
        }

        match current_section {
            "stat" => {
                stat_section.push_str(line);
                stat_section.push('\n');
            }
            "mem" => {
                mem_section.push_str(line);
                mem_section.push('\n');
            }
            "net" => {
                net_section.push_str(line);
                net_section.push('\n');
            }
            "df" => {
                df_section.push_str(line);
                df_section.push('\n');
            }
            "load" => {
                load_section.push_str(line);
                load_section.push('\n');
            }
            "uptime" => {
                uptime_section.push_str(line);
                uptime_section.push('\n');
            }
            _ => {}
        }
    }

    let (cpu, cpu_total_ticks, cpu_idle_ticks) = parse_cpu(&stat_section, prev_state);
    let memory = parse_memory(&mem_section);
    let (network, total_rx, total_tx) = parse_network(&net_section, prev_state, now_ms);
    let disk = parse_disk(&df_section);
    let load_avg = parse_load(&load_section);
    let uptime_seconds = parse_uptime(&uptime_section);

    let snapshot = SystemTelemetrySnapshot {
        timestamp_ms: now_ms,
        cpu,
        memory,
        disk,
        network,
        uptime_seconds,
        load_avg,
    };

    let next_state = PreviousMetricsState {
        timestamp_ms: now_ms,
        cpu_total_ticks,
        cpu_idle_ticks,
        total_rx_bytes: total_rx,
        total_tx_bytes: total_tx,
    };

    (snapshot, next_state)
}

fn parse_cpu(
    raw: &str,
    prev_state: &Option<PreviousMetricsState>,
) -> (CpuMetrics, u64, u64) {
    let mut total_ticks = 0u64;
    let mut idle_ticks = 0u64;
    let mut cores_count = 0usize;

    for line in raw.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        if parts[0] == "cpu" {
            // cpu user nice system idle iowait irq softirq steal guest guest_nice
            let numbers: Vec<u64> = parts[1..]
                .iter()
                .filter_map(|s| s.parse::<u64>().ok())
                .collect();

            if numbers.len() >= 4 {
                // user=0, nice=1, system=2, idle=3, iowait=4
                let idle = numbers[3];
                let iowait = if numbers.len() > 4 { numbers[4] } else { 0 };
                idle_ticks = idle + iowait;
                total_ticks = numbers.iter().sum();
            }
        } else if parts[0].starts_with("cpu") {
            cores_count += 1;
        }
    }

    if cores_count == 0 {
        cores_count = 1;
    }

    let mut usage_percent = 0.0f32;
    if let Some(prev) = prev_state {
        if total_ticks > prev.cpu_total_ticks && total_ticks >= prev.cpu_total_ticks {
            let delta_total = total_ticks - prev.cpu_total_ticks;
            let delta_idle = idle_ticks.saturating_sub(prev.cpu_idle_ticks);
            if delta_total > 0 {
                let active = delta_total.saturating_sub(delta_idle);
                usage_percent = (active as f32 / delta_total as f32) * 100.0;
            }
        }
    } else if total_ticks > 0 {
        let active = total_ticks.saturating_sub(idle_ticks);
        usage_percent = (active as f32 / total_ticks as f32) * 100.0;
    }

    usage_percent = usage_percent.clamp(0.0, 100.0);

    (
        CpuMetrics {
            total_usage_percent: (usage_percent * 10.0).round() / 10.0,
            cores_count,
        },
        total_ticks,
        idle_ticks,
    )
}

fn parse_memory(raw: &str) -> MemoryMetrics {
    let mut mem_total_kb = 0u64;
    let mut mem_free_kb = 0u64;
    let mut mem_available_kb = 0u64;
    let mut swap_total_kb = 0u64;
    let mut swap_free_kb = 0u64;

    for line in raw.lines() {
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() != 2 {
            continue;
        }
        let key = parts[0].trim();
        let val_str = parts[1].trim().split_whitespace().next().unwrap_or("0");
        let val = val_str.parse::<u64>().unwrap_or(0);

        match key {
            "MemTotal" => mem_total_kb = val,
            "MemFree" => mem_free_kb = val,
            "MemAvailable" => mem_available_kb = val,
            "SwapTotal" => swap_total_kb = val,
            "SwapFree" => swap_free_kb = val,
            _ => {}
        }
    }

    let total_bytes = mem_total_kb * 1024;
    let available_bytes = if mem_available_kb > 0 {
        mem_available_kb * 1024
    } else {
        mem_free_kb * 1024
    };
    let used_bytes = total_bytes.saturating_sub(available_bytes);
    let free_bytes = mem_free_kb * 1024;

    let usage_percent = if total_bytes > 0 {
        ((used_bytes as f32 / total_bytes as f32) * 100.0 * 10.0).round() / 10.0
    } else {
        0.0
    };

    let swap_total_bytes = swap_total_kb * 1024;
    let swap_free_bytes = swap_free_kb * 1024;
    let swap_used_bytes = swap_total_bytes.saturating_sub(swap_free_bytes);

    MemoryMetrics {
        total_bytes,
        used_bytes,
        free_bytes,
        available_bytes,
        usage_percent,
        swap_total_bytes,
        swap_used_bytes,
    }
}

fn parse_network(
    raw: &str,
    prev_state: &Option<PreviousMetricsState>,
    now_ms: u64,
) -> (NetworkMetrics, u64, u64) {
    let mut total_rx = 0u64;
    let mut total_tx = 0u64;

    for line in raw.lines() {
        if !line.contains(':') {
            continue;
        }
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() != 2 {
            continue;
        }
        let stats: Vec<u64> = parts[1]
            .split_whitespace()
            .filter_map(|s| s.parse::<u64>().ok())
            .collect();

        // format: rx_bytes rx_packets ... (8 fields) | tx_bytes tx_packets ...
        if stats.len() >= 9 {
            total_rx += stats[0];
            total_tx += stats[8];
        }
    }

    let mut rx_speed = 0.0f64;
    let mut tx_speed = 0.0f64;

    if let Some(prev) = prev_state {
        if now_ms > prev.timestamp_ms {
            let delta_secs = (now_ms - prev.timestamp_ms) as f64 / 1000.0;
            if delta_secs > 0.0 {
                let rx_diff = total_rx.saturating_sub(prev.total_rx_bytes) as f64;
                let tx_diff = total_tx.saturating_sub(prev.total_tx_bytes) as f64;
                rx_speed = rx_diff / delta_secs;
                tx_speed = tx_diff / delta_secs;
            }
        }
    }

    (
        NetworkMetrics {
            rx_bytes_per_sec: (rx_speed * 10.0).round() / 10.0,
            tx_bytes_per_sec: (tx_speed * 10.0).round() / 10.0,
            total_rx_bytes: total_rx,
            total_tx_bytes: total_tx,
        },
        total_rx,
        total_tx,
    )
}

fn parse_disk(raw: &str) -> DiskMetrics {
    for line in raw.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        // S.ficheros 1024-bloques Usados Disponibles Capacidad Montado en
        // /dev/sda1 15993696 8000000 7993696 50% /
        if parts.len() >= 6 && parts.last() == Some(&"/") {
            let total_kb = parts[1].parse::<u64>().unwrap_or(0);
            let used_kb = parts[2].parse::<u64>().unwrap_or(0);
            let free_kb = parts[3].parse::<u64>().unwrap_or(0);
            let cap_str = parts[4].trim_end_matches('%');
            let usage_percent = cap_str.parse::<f32>().unwrap_or(0.0);

            return DiskMetrics {
                total_bytes: total_kb * 1024,
                used_bytes: used_kb * 1024,
                free_bytes: free_kb * 1024,
                usage_percent,
                mount_point: "/".to_string(),
            };
        }
    }

    DiskMetrics {
        total_bytes: 0,
        used_bytes: 0,
        free_bytes: 0,
        usage_percent: 0.0,
        mount_point: "/".to_string(),
    }
}

fn parse_load(raw: &str) -> (f32, f32, f32) {
    let parts: Vec<&str> = raw.split_whitespace().collect();
    if parts.len() >= 3 {
        let l1 = parts[0].parse::<f32>().unwrap_or(0.0);
        let l5 = parts[1].parse::<f32>().unwrap_or(0.0);
        let l15 = parts[2].parse::<f32>().unwrap_or(0.0);
        return (l1, l5, l15);
    }
    (0.0, 0.0, 0.0)
}

fn parse_uptime(raw: &str) -> u64 {
    let parts: Vec<&str> = raw.split_whitespace().collect();
    if !parts.is_empty() {
        if let Ok(secs) = parts[0].parse::<f64>() {
            return secs.max(0.0) as u64;
        }
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_RAW: &str = r#"
===STAT===
cpu  954486 2718 183968 11769394 44230 20318 6347 0 0 0
cpu0 240000 1000 50000 3000000 10000 5000 1000 0 0 0
cpu1 240000 1000 50000 3000000 10000 5000 1000 0 0 0
cpu2 240000 1000 50000 3000000 10000 5000 1000 0 0 0
cpu3 234486 718 33968 2769394 14230 5318 3347 0 0 0
===MEM===
MemTotal:       32000000 kB
MemFree:          400000 kB
MemAvailable:   16000000 kB
SwapTotal:       8000000 kB
SwapFree:        6000000 kB
===NET===
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
 eth0: 10000000    1200    0    0    0     0          0         0  5000000     800    0    0    0     0       0          0
===DF===
Filesystem     1024-blocks      Used Available Capacity Mounted on
/dev/nvme0n1p2    10000000   4000000   6000000      40% /
===LOAD===
0.75 1.20 1.80 2/300 1234
===UPTIME===
7200.50 14400.00
"#;

    #[test]
    fn test_parse_telemetry_snapshot_initial() {
        let (snap, next_state) = parse_telemetry_output(SAMPLE_RAW, &None, 1000);

        assert_eq!(snap.cpu.cores_count, 4);
        assert!(snap.cpu.total_usage_percent > 0.0 && snap.cpu.total_usage_percent < 100.0);
        assert_eq!(snap.memory.total_bytes, 32000000 * 1024);
        assert_eq!(snap.memory.available_bytes, 16000000 * 1024);
        assert_eq!(snap.memory.used_bytes, 16000000 * 1024);
        assert_eq!(snap.memory.usage_percent, 50.0);
        assert_eq!(snap.memory.swap_total_bytes, 8000000 * 1024);
        assert_eq!(snap.memory.swap_used_bytes, 2000000 * 1024);

        assert_eq!(snap.network.total_rx_bytes, 10000000);
        assert_eq!(snap.network.total_tx_bytes, 5000000);
        assert_eq!(snap.network.rx_bytes_per_sec, 0.0); // No previous state

        assert_eq!(snap.disk.total_bytes, 10000000 * 1024);
        assert_eq!(snap.disk.used_bytes, 4000000 * 1024);
        assert_eq!(snap.disk.usage_percent, 40.0);

        assert_eq!(snap.load_avg, (0.75, 1.20, 1.80));
        assert_eq!(snap.uptime_seconds, 7200);

        assert_eq!(next_state.total_rx_bytes, 10000000);
        assert_eq!(next_state.total_tx_bytes, 5000000);
    }

    #[test]
    fn test_parse_telemetry_snapshot_differential() {
        let (_, prev_state) = parse_telemetry_output(SAMPLE_RAW, &None, 1000);

        // Next snapshot after 2 seconds with 200 KB rx and 100 KB tx increase
        let next_raw = SAMPLE_RAW.replace(
            "eth0: 10000000",
            "eth0: 10204800", // +204800 bytes (200 KB) in 2 seconds -> 102400 B/s
        ).replace(
            " 5000000 ",
            " 5102400 ", // +102400 bytes (100 KB) in 2 seconds -> 51200 B/s
        );

        let (snap2, _) = parse_telemetry_output(&next_raw, &Some(prev_state), 3000);

        assert_eq!(snap2.network.rx_bytes_per_sec, 102400.0);
        assert_eq!(snap2.network.tx_bytes_per_sec, 51200.0);
    }

    #[test]
    fn test_parse_telemetry_empty_and_graceful_fallback() {
        let (snap, _) = parse_telemetry_output("", &None, 1000);
        assert_eq!(snap.cpu.total_usage_percent, 0.0);
        assert_eq!(snap.cpu.cores_count, 1);
        assert_eq!(snap.memory.total_bytes, 0);
        assert_eq!(snap.disk.total_bytes, 0);
        assert_eq!(snap.uptime_seconds, 0);
        assert_eq!(snap.load_avg, (0.0, 0.0, 0.0));
    }
}
