use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use chrono::DateTime;
use russh_sftp::client::SftpSession;
use tauri::ipc::Channel;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::ssh::create_authenticated_ssh_session;
use crate::vault::db::VaultManager;
use super::models::{format_mode_to_string, SftpEntry, TransferDirection, TransferProgress};

pub struct SftpSessionItem {
    pub host_id: String,
    pub session: Arc<SftpSession>,
}

#[derive(Default, Clone)]
pub struct SftpSessionManager {
    sessions: Arc<Mutex<HashMap<String, SftpSessionItem>>>,
}

impl SftpSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn connect(
        &self,
        vault_mgr: Arc<VaultManager>,
        host_id: &str,
    ) -> Result<String, String> {
        let ssh_session = create_authenticated_ssh_session(vault_mgr, host_id).await?;

        let channel = ssh_session
            .channel_open_session()
            .await
            .map_err(|e| format!("Could not open an SSH channel for SFTP: {}", e))?;

        channel
            .request_subsystem(false, "sftp")
            .await
            .map_err(|e| format!("El servidor SSH no tiene habilitado el subsistema SFTP: {}", e))?;

        let stream = channel.into_stream();
        let sftp = SftpSession::new(stream)
            .await
            .map_err(|e| format!("Could not initialize the SFTP session: {}", e))?;

        let session_id = Uuid::now_v7().to_string();
        let mut map = self.sessions.lock().await;
        map.insert(
            session_id.clone(),
            SftpSessionItem {
                host_id: host_id.to_string(),
                session: Arc::new(sftp),
            },
        );

        Ok(session_id)
    }

    async fn get_session(&self, session_id: &str) -> Result<Arc<SftpSession>, String> {
        let map = self.sessions.lock().await;
        map.get(session_id)
            .map(|item| item.session.clone())
            .ok_or_else(|| "SFTP session not found or disconnected".to_string())
    }

    pub async fn resolve_home(&self, session_id: &str) -> Result<String, String> {
        let sftp = self.get_session(session_id).await?;
        sftp.canonicalize(".")
            .await
            .map_err(|e| format!("Could not resolve the initial directory: {}", e))
    }

    pub async fn list_dir(
        &self,
        session_id: &str,
        path: Option<&str>,
    ) -> Result<(String, Vec<SftpEntry>), String> {
        let sftp = self.get_session(session_id).await?;
        let target_path = match path {
            Some(p) if !p.trim().is_empty() => p.to_string(),
            _ => sftp
                .canonicalize(".")
                .await
                .map_err(|e| format!("Could not resolve the root directory: {}", e))?,
        };

        let mut read_dir = sftp
            .read_dir(&target_path)
            .await
            .map_err(|e| format!("Could not list directory {}: {}", target_path, e))?;

        let mut entries = Vec::new();
        while let Some(entry) = read_dir.next() {
            let meta = entry.metadata();
            let is_dir = meta.is_dir();
            let is_symlink = meta.is_symlink();
            let size = meta.size.unwrap_or(0);
            let mode = meta.permissions.unwrap_or(if is_dir { 0o755 } else { 0o644 });
            let permissions_octal = format!("{:04o}", mode & 0o777);
            let permissions_str = format_mode_to_string(mode, is_dir, is_symlink);

            let modified_at = meta.mtime.and_then(|ts| {
                DateTime::from_timestamp(ts as i64, 0).map(|dt| dt.to_rfc3339())
            });

            entries.push(SftpEntry {
                name: entry.file_name(),
                path: entry.path(),
                size,
                is_dir,
                is_symlink,
                permissions_octal,
                permissions_str,
                modified_at,
            });
        }

        // Ordenar: directorios primero, luego orden alfabético insensible a mayúsculas
        entries.sort_by(|a, b| {
            b.is_dir
                .cmp(&a.is_dir)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });

        Ok((target_path, entries))
    }

    pub async fn mkdir(&self, session_id: &str, path: &str) -> Result<(), String> {
        let sftp = self.get_session(session_id).await?;
        sftp.create_dir(path)
            .await
            .map_err(|e| format!("Could not create folder {}: {}", path, e))
    }

    pub async fn rename(&self, session_id: &str, old_path: &str, new_path: &str) -> Result<(), String> {
        let sftp = self.get_session(session_id).await?;
        sftp.rename(old_path, new_path)
            .await
            .map_err(|e| format!("Could not rename {} to {}: {}", old_path, new_path, e))
    }

    pub async fn remove(&self, session_id: &str, path: &str, is_dir: bool) -> Result<(), String> {
        let sftp = self.get_session(session_id).await?;
        if is_dir {
            sftp.remove_dir(path)
                .await
                .map_err(|e| format!("Could not delete folder {}: {}", path, e))
        } else {
            sftp.remove_file(path)
                .await
                .map_err(|e| format!("Could not delete file {}: {}", path, e))
        }
    }

    pub async fn download_file(
        &self,
        session_id: &str,
        remote_path: &str,
        local_path: &str,
        progress_channel: Option<Channel<TransferProgress>>,
    ) -> Result<(), String> {
        let transfer_id = Uuid::now_v7().to_string();
        let filename = Path::new(remote_path)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| remote_path.to_string());

        let res = self
            .download_file_internal(
                session_id,
                remote_path,
                local_path,
                &transfer_id,
                &filename,
                &progress_channel,
            )
            .await;

        if let Err(ref err) = res {
            if let Some(ref ch) = progress_channel {
                let _ = ch.send(TransferProgress {
                    transfer_id,
                    direction: TransferDirection::Download,
                    filename,
                    bytes_transferred: 0,
                    total_bytes: 0,
                    percentage: 0.0,
                    status: "error".to_string(),
                    error_message: Some(err.clone()),
                });
            }
        }

        res
    }

    async fn download_file_internal(
        &self,
        session_id: &str,
        remote_path: &str,
        local_path: &str,
        transfer_id: &str,
        filename: &str,
        progress_channel: &Option<Channel<TransferProgress>>,
    ) -> Result<(), String> {
        let sftp = self.get_session(session_id).await?;
        let meta = sftp
            .metadata(remote_path)
            .await
            .map_err(|e| format!("Could not read metadata of {}: {}", remote_path, e))?;

        let total_bytes = meta.size.unwrap_or(0);

        let mut remote_file = sftp
            .open(remote_path)
            .await
            .map_err(|e| format!("Could not open remote file {}: {}", remote_path, e))?;

        let mut local_file = tokio::fs::File::create(local_path)
            .await
            .map_err(|e| format!("Could not create local file {}: {}", local_path, e))?;

        let mut buffer = [0u8; 64 * 1024]; // Bloques de 64 KB
        let mut transferred: u64 = 0;

        loop {
            let n = remote_file
                .read(&mut buffer)
                .await
                .map_err(|e| format!("Could not read remote file: {}", e))?;

            if n == 0 {
                break;
            }

            local_file
                .write_all(&buffer[..n])
                .await
                .map_err(|e| format!("Could not write local file: {}", e))?;

            transferred += n as u64;

            if let Some(ch) = progress_channel {
                let percentage = if total_bytes > 0 {
                    (transferred as f64 / total_bytes as f64) * 100.0
                } else {
                    100.0
                };
                let _ = ch.send(TransferProgress {
                    transfer_id: transfer_id.to_string(),
                    direction: TransferDirection::Download,
                    filename: filename.to_string(),
                    bytes_transferred: transferred,
                    total_bytes,
                    percentage,
                    status: "in_progress".to_string(),
                    error_message: None,
                });
            }
        }

        local_file
            .flush()
            .await
            .map_err(|e| format!("Could not close local file: {}", e))?;

        if let Some(ch) = progress_channel {
            let _ = ch.send(TransferProgress {
                transfer_id: transfer_id.to_string(),
                direction: TransferDirection::Download,
                filename: filename.to_string(),
                bytes_transferred: transferred,
                total_bytes,
                percentage: 100.0,
                status: "completed".to_string(),
                error_message: None,
            });
        }

        Ok(())
    }

    pub async fn upload_file(
        &self,
        session_id: &str,
        local_path: &str,
        remote_path: &str,
        progress_channel: Option<Channel<TransferProgress>>,
    ) -> Result<(), String> {
        let transfer_id = Uuid::now_v7().to_string();
        let filename = Path::new(local_path)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| local_path.to_string());

        let res = self
            .upload_file_internal(
                session_id,
                local_path,
                remote_path,
                &transfer_id,
                &filename,
                &progress_channel,
            )
            .await;

        if let Err(ref err) = res {
            if let Some(ref ch) = progress_channel {
                let _ = ch.send(TransferProgress {
                    transfer_id,
                    direction: TransferDirection::Upload,
                    filename,
                    bytes_transferred: 0,
                    total_bytes: 0,
                    percentage: 0.0,
                    status: "error".to_string(),
                    error_message: Some(err.clone()),
                });
            }
        }

        res
    }

    async fn upload_file_internal(
        &self,
        session_id: &str,
        local_path: &str,
        remote_path: &str,
        transfer_id: &str,
        filename: &str,
        progress_channel: &Option<Channel<TransferProgress>>,
    ) -> Result<(), String> {
        let sftp = self.get_session(session_id).await?;

        let mut local_file = tokio::fs::File::open(local_path)
            .await
            .map_err(|e| format!("Could not open local file {}: {}", local_path, e))?;

        let local_meta = local_file
            .metadata()
            .await
            .map_err(|e| format!("Could not get local file size: {}", e))?;
        let total_bytes = local_meta.len();

        let mut remote_file = sftp
            .create(remote_path)
            .await
            .map_err(|e| format!("Could not create remote file {}: {}", remote_path, e))?;

        let mut buffer = [0u8; 64 * 1024]; // 64 KB
        let mut transferred: u64 = 0;

        loop {
            let n = local_file
                .read(&mut buffer)
                .await
                .map_err(|e| format!("Could not read local file: {}", e))?;

            if n == 0 {
                break;
            }

            remote_file
                .write_all(&buffer[..n])
                .await
                .map_err(|e| format!("Could not write to remote file: {}", e))?;

            transferred += n as u64;

            if let Some(ch) = progress_channel {
                let percentage = if total_bytes > 0 {
                    (transferred as f64 / total_bytes as f64) * 100.0
                } else {
                    100.0
                };
                let _ = ch.send(TransferProgress {
                    transfer_id: transfer_id.to_string(),
                    direction: TransferDirection::Upload,
                    filename: filename.to_string(),
                    bytes_transferred: transferred,
                    total_bytes,
                    percentage,
                    status: "in_progress".to_string(),
                    error_message: None,
                });
            }
        }

        remote_file
            .flush()
            .await
            .map_err(|e| format!("Could not close remote file: {}", e))?;

        if let Some(ch) = progress_channel {
            let _ = ch.send(TransferProgress {
                transfer_id: transfer_id.to_string(),
                direction: TransferDirection::Upload,
                filename: filename.to_string(),
                bytes_transferred: transferred,
                total_bytes,
                percentage: 100.0,
                status: "completed".to_string(),
                error_message: None,
            });
        }

        Ok(())
    }

    pub async fn disconnect(&self, session_id: &str) -> Result<(), String> {
        let mut map = self.sessions.lock().await;
        if let Some(item) = map.remove(session_id) {
            let _ = item.session.close().await;
        }
        Ok(())
    }
}
