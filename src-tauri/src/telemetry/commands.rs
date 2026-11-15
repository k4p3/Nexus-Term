use std::collections::HashMap;
use std::sync::Arc;
use tauri::ipc::Channel;
use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

use crate::ssh::create_authenticated_ssh_session;
use crate::vault::db::VaultManager;
use super::collector::TelemetryCollector;
use super::models::{PreviousMetricsState, SystemTelemetrySnapshot};

#[derive(Default, Clone)]
pub struct TelemetryManager {
    streams: Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
}

impl TelemetryManager {
    pub fn new() -> Self {
        Self {
            streams: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn start_stream(
        &self,
        vault_mgr: Arc<VaultManager>,
        host_id: &str,
        interval_secs: u64,
        channel: Channel<SystemTelemetrySnapshot>,
    ) -> Result<String, String> {
        let session = create_authenticated_ssh_session(vault_mgr, host_id).await?;
        let stream_id = Uuid::now_v7().to_string();
        let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();

        let interval_duration = tokio::time::Duration::from_secs(interval_secs.max(1));
        let streams_map = self.streams.clone();
        let stream_id_clone = stream_id.clone();

        tokio::spawn(async move {
            let mut prev_state: Option<PreviousMetricsState> = None;
            let mut ticker = tokio::time::interval(interval_duration);

            loop {
                tokio::select! {
                    _ = &mut cancel_rx => {
                        break;
                    }
                    _ = ticker.tick() => {
                        match TelemetryCollector::collect_once(&session, &prev_state).await {
                            Ok((snapshot, next_state)) => {
                                prev_state = Some(next_state);
                                if channel.send(snapshot).is_err() {
                                    break;
                                }
                            }
                            Err(e) => {
                                tracing::warn!("Error collecting telemetry snapshot: {}", e);
                            }
                        }
                    }
                }
            }

            let _ = session.disconnect(russh::Disconnect::ByApplication, "telemetry_closed", "en").await;
            streams_map.lock().await.remove(&stream_id_clone);
        });

        self.streams.lock().await.insert(stream_id.clone(), cancel_tx);
        Ok(stream_id)
    }

    pub async fn stop_stream(&self, stream_id: &str) -> Result<(), String> {
        let mut map = self.streams.lock().await;
        if let Some(cancel_tx) = map.remove(stream_id) {
            let _ = cancel_tx.send(());
        }
        Ok(())
    }
}

#[tauri::command]
pub async fn fetch_telemetry_snapshot(
    vault_manager: tauri::State<'_, Arc<VaultManager>>,
    host_id: String,
) -> Result<SystemTelemetrySnapshot, String> {
    TelemetryCollector::fetch_single_snapshot(vault_manager.inner().clone(), &host_id).await
}

#[tauri::command]
pub async fn start_telemetry_stream(
    vault_manager: tauri::State<'_, Arc<VaultManager>>,
    telemetry_manager: tauri::State<'_, Arc<TelemetryManager>>,
    host_id: String,
    interval_secs: u64,
    channel: Channel<SystemTelemetrySnapshot>,
) -> Result<String, String> {
    telemetry_manager
        .start_stream(vault_manager.inner().clone(), &host_id, interval_secs, channel)
        .await
}

#[tauri::command]
pub async fn stop_telemetry_stream(
    telemetry_manager: tauri::State<'_, Arc<TelemetryManager>>,
    stream_id: String,
) -> Result<(), String> {
    telemetry_manager.stop_stream(&stream_id).await
}
