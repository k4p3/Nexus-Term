use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::State;

use crate::vault::db::VaultManager;
use super::client::SftpSessionManager;
use super::models::{SftpEntry, TransferProgress};

#[tauri::command]
pub async fn sftp_connect(
    vault: State<'_, Arc<VaultManager>>,
    sftp_mgr: State<'_, Arc<SftpSessionManager>>,
    host_id: String,
) -> Result<String, String> {
    let vault_mgr = vault.inner().clone();
    sftp_mgr.connect(vault_mgr, &host_id).await
}

#[tauri::command]
pub async fn sftp_resolve_home(
    sftp_mgr: State<'_, Arc<SftpSessionManager>>,
    session_id: String,
) -> Result<String, String> {
    sftp_mgr.resolve_home(&session_id).await
}

#[tauri::command]
pub async fn sftp_list_dir(
    sftp_mgr: State<'_, Arc<SftpSessionManager>>,
    session_id: String,
    path: Option<String>,
) -> Result<(String, Vec<SftpEntry>), String> {
    sftp_mgr.list_dir(&session_id, path.as_deref()).await
}

#[tauri::command]
pub async fn sftp_mkdir(
    sftp_mgr: State<'_, Arc<SftpSessionManager>>,
    session_id: String,
    path: String,
) -> Result<(), String> {
    sftp_mgr.mkdir(&session_id, &path).await
}

#[tauri::command]
pub async fn sftp_rename(
    sftp_mgr: State<'_, Arc<SftpSessionManager>>,
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    sftp_mgr.rename(&session_id, &old_path, &new_path).await
}

#[tauri::command]
pub async fn sftp_remove(
    sftp_mgr: State<'_, Arc<SftpSessionManager>>,
    session_id: String,
    path: String,
    is_dir: bool,
) -> Result<(), String> {
    sftp_mgr.remove(&session_id, &path, is_dir).await
}

#[tauri::command]
pub async fn sftp_download(
    sftp_mgr: State<'_, Arc<SftpSessionManager>>,
    session_id: String,
    remote_path: String,
    local_path: String,
    on_progress: Channel<TransferProgress>,
) -> Result<(), String> {
    sftp_mgr
        .download_file(&session_id, &remote_path, &local_path, Some(on_progress))
        .await
}

#[tauri::command]
pub async fn sftp_upload(
    sftp_mgr: State<'_, Arc<SftpSessionManager>>,
    session_id: String,
    local_path: String,
    remote_path: String,
    on_progress: Channel<TransferProgress>,
) -> Result<(), String> {
    sftp_mgr
        .upload_file(&session_id, &local_path, &remote_path, Some(on_progress))
        .await
}

#[tauri::command]
pub async fn sftp_disconnect(
    sftp_mgr: State<'_, Arc<SftpSessionManager>>,
    session_id: String,
) -> Result<(), String> {
    sftp_mgr.disconnect(&session_id).await
}
