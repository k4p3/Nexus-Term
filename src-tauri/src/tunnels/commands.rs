use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;

use crate::vault::db::VaultManager;
use super::db::{delete_tunnel_internal, get_tunnel_by_id_internal, get_tunnels_internal, save_tunnel_internal};
use super::manager::SshTunnelManager;
use super::models::{TunnelConfig, TunnelConfigPayload, TunnelRuntimeStatus};

#[tauri::command]
pub async fn list_tunnels(
    vault: State<'_, Arc<VaultManager>>,
    host_id: Option<String>,
) -> Result<Vec<TunnelConfig>, String> {
    let conn = vault.db.lock().map_err(|e| e.to_string())?;
    get_tunnels_internal(&conn, host_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_tunnel(
    vault: State<'_, Arc<VaultManager>>,
    payload: TunnelConfigPayload,
) -> Result<TunnelConfig, String> {
    if payload.local_port == 0 {
        return Err("El puerto local debe ser mayor a 0".to_string());
    }
    let conn = vault.db.lock().map_err(|e| e.to_string())?;
    save_tunnel_internal(&conn, &payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_tunnel(
    vault: State<'_, Arc<VaultManager>>,
    tunnel_mgr: State<'_, Arc<SshTunnelManager>>,
    id: String,
) -> Result<(), String> {
    let _ = tunnel_mgr.stop_tunnel(&id).await;
    let conn = vault.db.lock().map_err(|e| e.to_string())?;
    delete_tunnel_internal(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_tunnel(
    vault: State<'_, Arc<VaultManager>>,
    tunnel_mgr: State<'_, Arc<SshTunnelManager>>,
    id: String,
) -> Result<(), String> {
    let tunnel = {
        let conn = vault.db.lock().map_err(|e| e.to_string())?;
        get_tunnel_by_id_internal(&conn, &id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Túnel no encontrado".to_string())?
    };

    let vault_mgr = vault.inner().clone();
    tunnel_mgr.start_tunnel(vault_mgr, tunnel).await
}

#[tauri::command]
pub async fn stop_tunnel(
    tunnel_mgr: State<'_, Arc<SshTunnelManager>>,
    id: String,
) -> Result<(), String> {
    tunnel_mgr.stop_tunnel(&id).await
}

#[tauri::command]
pub async fn get_tunnel_statuses(
    tunnel_mgr: State<'_, Arc<SshTunnelManager>>,
) -> Result<HashMap<String, TunnelRuntimeStatus>, String> {
    Ok(tunnel_mgr.get_statuses().await)
}
