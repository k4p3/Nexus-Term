# Delta Spec: Live Telemetry & System Monitoring

## ADDED Requirements

### Requirement: Remote System Metrics Collection
The system SHALL collect real-time telemetry metrics from the connected remote host using an SSH exec channel over the existing multiplexed SSH connection without requiring any remote agent or daemon.

#### Scenario: Successful Linux telemetry collection
- **WHEN** a telemetry snapshot is requested for an active SSH session connected to a Linux server
- **THEN** the backend executes non-invasive commands reading `/proc/stat`, `/proc/meminfo`, `/proc/net/dev`, `df`, and `uptime`
- **AND** parses the raw outputs into a structured `SystemTelemetrySnapshot` containing CPU percentage, RAM used/total, disk capacity, and network throughput.

#### Scenario: Fallback on non-standard or restricted environments
- **WHEN** the remote server lacks specific `/proc` entries or permission to read them
- **THEN** the parser SHALL return available metrics without throwing a fatal connection error
- **AND** mark missing metrics as zero or null in the snapshot.

---

### Requirement: Streaming Telemetry Updates
The backend SHALL support periodic streaming of telemetry snapshots to the frontend using an asynchronous Tauri IPC Channel with configurable update intervals.

#### Scenario: Start and receive streaming telemetry
- **WHEN** the frontend invokes `start_telemetry_stream` with a valid session ID and an interval in seconds (e.g., 2 seconds)
- **THEN** the backend spawns a non-blocking background Tokio task that executes the collection command every interval
- **AND** transmits each `SystemTelemetrySnapshot` across `tauri::ipc::Channel` to the frontend subscriber.

#### Scenario: Stop telemetry stream
- **WHEN** the frontend invokes `stop_telemetry_stream` or the terminal tab/session is closed
- **THEN** the background Tokio task SHALL terminate immediately and release all associated channels.

---

### Requirement: Integrated Terminal Telemetry Bar
The frontend SHALL provide a compact and non-intrusive `TelemetryBar` component integrated into the terminal pane for remote SSH sessions.

#### Scenario: Display live metrics with severity indicators
- **WHEN** telemetry is enabled for a remote pane
- **THEN** the `TelemetryBar` SHALL display CPU usage percentage, memory usage (used/total and percentage), disk usage, uptime, and real-time network speeds (download and upload)
- **AND** visually distinguish healthy states (< 70%), warning states (70% - 85%), and critical states (> 85%) using distinct colors.

#### Scenario: Toggle and configure telemetry
- **WHEN** the user clicks the telemetry toggle button in the terminal pane header
- **THEN** the `TelemetryBar` SHALL collapse or expand smoothly without altering terminal cursor focus
- **AND** allow pausing the stream or changing the polling interval.
