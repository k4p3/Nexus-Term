use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use russh::client::Handle;

use crate::ssh::{create_authenticated_ssh_session, SshClientHandler};
use crate::vault::db::VaultManager;
use super::models::{PreviousMetricsState, SystemTelemetrySnapshot};
use super::parser::{parse_telemetry_output, TELEMETRY_SHELL_COMMAND};

pub struct TelemetryCollector;

impl TelemetryCollector {
    pub async fn collect_once(
        session: &Handle<SshClientHandler>,
        prev_state: &Option<PreviousMetricsState>,
    ) -> Result<(SystemTelemetrySnapshot, PreviousMetricsState), String> {
        let mut channel = session
            .channel_open_session()
            .await
            .map_err(|e| format!("Error al abrir canal SSH para telemetría: {}", e))?;

        channel
            .exec(true, TELEMETRY_SHELL_COMMAND)
            .await
            .map_err(|e| format!("Error al ejecutar comando de telemetría: {}", e))?;

        let mut output = Vec::new();
        while let Some(msg) = channel.wait().await {
            match msg {
                russh::ChannelMsg::Data { ref data } => {
                    output.extend_from_slice(data);
                }
                russh::ChannelMsg::ExtendedData { ref data, .. } => {
                    output.extend_from_slice(data);
                }
                russh::ChannelMsg::Eof | russh::ChannelMsg::Close => {
                    break;
                }
                _ => {}
            }
        }

        let raw_str = String::from_utf8_lossy(&output);
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        Ok(parse_telemetry_output(&raw_str, prev_state, now_ms))
    }

    pub async fn fetch_single_snapshot(
        vault_mgr: Arc<VaultManager>,
        host_id: &str,
    ) -> Result<SystemTelemetrySnapshot, String> {
        let session = create_authenticated_ssh_session(vault_mgr, host_id).await?;
        let (snapshot, _) = Self::collect_once(&session, &None).await?;
        let _ = session.disconnect(russh::Disconnect::ByApplication, "telemetry_done", "en").await;
        Ok(snapshot)
    }
}
