use chrono::Utc;
use rusqlite::params;
use russh::client::{self, Handler};
use russh::keys::key::PrivateKeyWithHashAlg;
use russh::keys::{decode_secret_key, HashAlg, PublicKey};
use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;
use tauri::ipc::Channel;
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;

use crate::vault::db::VaultManager;

pub struct SshClientHandler {
    pub hostname: String,
    pub port: u16,
    pub vault_manager: Arc<VaultManager>,
}

impl Handler for SshClientHandler {
    type Error = russh::Error;

    fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> impl Future<Output = Result<bool, Self::Error>> + Send {
        let key_type = server_public_key.key_data().algorithm().as_str().to_string();
        let fingerprint = server_public_key.fingerprint(HashAlg::Sha256).to_string();
        let pubkey_str = server_public_key.to_openssh().unwrap_or_default();

        let hostname = self.hostname.clone();
        let port = self.port;
        let vault_mgr = self.vault_manager.clone();

        async move {
            let conn = vault_mgr.db.lock().unwrap();
            let existing: Result<(String, String), _> = conn.query_row(
                "SELECT fingerprint_sha256, public_key_base64 FROM known_hosts WHERE hostname = ?1 AND port = ?2",
                params![hostname, port as u32],
                |row| Ok((row.get(0)?, row.get(1)?)),
            );

            match existing {
                Ok((known_fp, known_key)) => {
                    if known_fp == fingerprint && known_key == pubkey_str {
                        Ok(true)
                    } else {
                        tracing::error!(
                            "HOST KEY MISMATCH for {}:{}! Possible MITM attack. Expected: {}, Got: {}",
                            hostname,
                            port,
                            known_fp,
                            fingerprint
                        );
                        Ok(false)
                    }
                }
                Err(rusqlite::Error::QueryReturnedNoRows) => {
                    // Trust On First Use (TOFU)
                    let id = Uuid::now_v7().to_string();
                    let now = Utc::now().to_rfc3339();
                    let _ = conn.execute(
                        "INSERT INTO known_hosts (id, hostname, port, key_type, fingerprint_sha256, public_key_base64, trusted_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![
                            id,
                            hostname,
                            port as u32,
                            key_type,
                            fingerprint,
                            pubkey_str,
                            now
                        ],
                    );
                    tracing::info!(
                        "Trusted new host key for {}:{} ({})",
                        hostname,
                        port,
                        fingerprint
                    );
                    Ok(true)
                }
                Err(_) => Ok(false),
            }
        }
    }
}

pub enum SshSessionCommand {
    Write(Vec<u8>),
    Resize { cols: u16, rows: u16 },
    Close,
}

#[derive(Default, Clone)]
pub struct SshSessionManager {
    sessions: Arc<Mutex<HashMap<String, mpsc::Sender<SshSessionCommand>>>>,
}

pub async fn create_authenticated_ssh_session(
    vault_mgr: Arc<VaultManager>,
    host_id: &str,
) -> Result<client::Handle<SshClientHandler>, String> {
    let inv = vault_mgr
        .get_inventory()
        .map_err(|e| format!("Vault error: {}", e))?;

    let host = inv
        .hosts
        .into_iter()
        .find(|h| h.id == host_id)
        .ok_or_else(|| "Host not found".to_string())?;

    let identity = if let Some(id_id) = &host.identity_id {
        Some(
            vault_mgr
                .get_decrypted_identity(id_id)
                .map_err(|e| format!("Failed to decrypt identity: {}", e))?,
        )
    } else {
        None
    };

    let username = host
        .username_override
        .as_deref()
        .or_else(|| identity.as_ref().map(|i| i.username.as_str()))
        .unwrap_or("root");

    let config = Arc::new(client::Config::default());
    let handler = SshClientHandler {
        hostname: host.hostname.clone(),
        port: host.port,
        vault_manager: vault_mgr.clone(),
    };

    let mut session = if let Some(ref jump_id) = host.jump_host_id {
        let jump_session = Box::pin(create_authenticated_ssh_session(vault_mgr.clone(), jump_id))
            .await
            .map_err(|e| format!("Servidor de Salto (Bastion) falló al conectar: {}", e))?;

        let channel = jump_session
            .channel_open_direct_tcpip(&host.hostname, host.port as u32, "127.0.0.1", 0)
            .await
            .map_err(|e| {
                format!(
                    "Fallo al abrir canal direct-tcpip hacia {}:{} a través del Bastion: {}",
                    host.hostname, host.port, e
                )
            })?;

        let stream = channel.into_stream();

        // Keep jump host session active in background for the lifetime of the direct-tcpip stream
        tokio::spawn(async move {
            let _keep = jump_session;
            tokio::time::sleep(tokio::time::Duration::from_secs(365 * 24 * 3600)).await;
        });

        client::connect_stream(config, stream, handler)
            .await
            .map_err(|e| format!("Fallo de negociación SSH a través del canal Bastion: {}", e))?
    } else {
        let addr = format!("{}:{}", host.hostname, host.port);
        client::connect(config, addr, handler)
            .await
            .map_err(|e| format!("SSH connection failed: {}", e))?
    };

    // Authenticate
    let mut authenticated = false;
    if let Some(ident) = &identity {
        if ident.auth_type == "password" {
            if let Some(pwd) = &ident.secret {
                let res = session
                    .authenticate_password(username, pwd)
                    .await
                    .map_err(|e| format!("SSH password auth error: {}", e))?;
                authenticated = matches!(res, client::AuthResult::Success);
            }
        } else if ident.auth_type == "private_key" {
            if let Some(key_data) = &ident.secret {
                let passphrase = ident.passphrase.as_deref();
                let key = decode_secret_key(key_data, passphrase)
                    .map_err(|e| format!("Failed to decode private key: {}", e))?;
                let key_with_alg = PrivateKeyWithHashAlg::new(Arc::new(key), None);
                let res = session
                    .authenticate_publickey(username, key_with_alg)
                    .await
                    .map_err(|e| format!("SSH public key auth error: {}", e))?;
                authenticated = matches!(res, client::AuthResult::Success);
            }
        } else if ident.auth_type == "agent" {
            #[cfg(unix)]
            let mut agent_client = russh::keys::agent::client::AgentClient::connect_env()
                .await
                .map_err(|e| format!("SSH agent connection failed: {}. Ensure SSH_AUTH_SOCK is active and valid.", e))?;

            #[cfg(windows)]
            let mut agent_client = russh::keys::agent::client::AgentClient::connect_pageant().await;

            let identities = agent_client
                .request_identities()
                .await
                .map_err(|e| format!("Failed to query identities from SSH agent: {}", e))?;

            if identities.is_empty() {
                return Err("SSH agent has no keys loaded. Add keys using ssh-add first.".to_string());
            }

            for pubkey in identities {
                let res = session
                    .authenticate_publickey_with(username, pubkey, None, &mut agent_client)
                    .await;

                if let Ok(client::AuthResult::Success) = res {
                    authenticated = true;
                    break;
                }
            }
        }
    }

    if !authenticated {
        return Err("SSH Authentication failed or credentials rejected by server".to_string());
    }

    Ok(session)
}

impl SshSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn connect(
        &self,
        vault_mgr: Arc<VaultManager>,
        host_id: &str,
        cols: u16,
        rows: u16,
        on_data: Channel<Vec<u8>>,
    ) -> Result<String, String> {
        let session = create_authenticated_ssh_session(vault_mgr, host_id).await?;

        // Open interactive channel
        let mut channel = session
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open SSH channel: {}", e))?;

        channel
            .request_pty(
                false,
                "xterm-256color",
                cols as u32,
                rows as u32,
                0,
                0,
                &[],
            )
            .await
            .map_err(|e| format!("Failed to request PTY: {}", e))?;

        channel
            .request_shell(false)
            .await
            .map_err(|e| format!("Failed to start shell: {}", e))?;

        let session_id = Uuid::now_v7().to_string();
        let (cmd_tx, mut cmd_rx) = mpsc::channel::<SshSessionCommand>(64);

        // Actor loop handling bidirectional PTY streaming
        let sess_id_clone = session_id.clone();
        let sessions_map = self.sessions.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    cmd = cmd_rx.recv() => {
                        match cmd {
                            Some(SshSessionCommand::Write(data)) => {
                                let _ = channel.data(&data[..]).await;
                            }
                            Some(SshSessionCommand::Resize { cols, rows }) => {
                                let _ = channel.window_change(cols as u32, rows as u32, 0, 0).await;
                            }
                            Some(SshSessionCommand::Close) | None => {
                                let _ = channel.eof().await;
                                break;
                            }
                        }
                    }
                    msg = channel.wait() => {
                        match msg {
                            Some(russh::ChannelMsg::Data { ref data }) => {
                                if on_data.send(data.to_vec()).is_err() {
                                    break;
                                }
                            }
                            Some(russh::ChannelMsg::ExtendedData { ref data, .. }) => {
                                if on_data.send(data.to_vec()).is_err() {
                                    break;
                                }
                            }
                            Some(russh::ChannelMsg::Eof) | Some(russh::ChannelMsg::Close) | None => {
                                break;
                            }
                            _ => {}
                        }
                    }
                }
            }
            sessions_map.lock().await.remove(&sess_id_clone);
        });

        self.sessions
            .lock()
            .await
            .insert(session_id.clone(), cmd_tx);

        Ok(session_id)
    }

    pub async fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let guard = self.sessions.lock().await;
        if let Some(tx) = guard.get(session_id) {
            tx.send(SshSessionCommand::Write(data.to_vec()))
                .await
                .map_err(|e| format!("SSH write error: {}", e))?;
            Ok(())
        } else {
            Err("SSH session not found".to_string())
        }
    }

    pub async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let guard = self.sessions.lock().await;
        if let Some(tx) = guard.get(session_id) {
            tx.send(SshSessionCommand::Resize { cols, rows })
                .await
                .map_err(|e| format!("SSH resize error: {}", e))?;
            Ok(())
        } else {
            Err("SSH session not found".to_string())
        }
    }

    pub async fn close(&self, session_id: &str) -> Result<(), String> {
        let mut guard = self.sessions.lock().await;
        if let Some(tx) = guard.remove(session_id) {
            let _ = tx.send(SshSessionCommand::Close).await;
        }
        Ok(())
    }
}

// Tauri Command for SSH connection
#[tauri::command]
pub async fn connect_ssh(
    vault_mgr: tauri::State<'_, Arc<VaultManager>>,
    ssh_mgr: tauri::State<'_, SshSessionManager>,
    host_id: String,
    cols: u16,
    rows: u16,
    on_data: Channel<Vec<u8>>,
) -> Result<String, String> {
    ssh_mgr
        .connect(vault_mgr.inner().clone(), &host_id, cols, rows, on_data)
        .await
}
