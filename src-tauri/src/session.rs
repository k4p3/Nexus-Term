use crate::pty::PtySessionManager;
use crate::ssh::SshSessionManager;
use serde::Serialize;

#[derive(Serialize)]
pub struct GeneratedSshKey {
    pub private_key: String,
    pub public_key: String,
    pub fingerprint: String,
}

#[tauri::command]
pub fn generate_ssh_key(algorithm: Option<String>) -> Result<GeneratedSshKey, String> {
    let alg = match algorithm.as_deref() {
        Some("rsa") => russh::keys::Algorithm::Rsa { hash: None },
        _ => russh::keys::Algorithm::Ed25519,
    };
    let key = russh::keys::PrivateKey::random(&mut rand::rngs::OsRng, alg)
        .map_err(|e| format!("Failed to generate key: {}", e))?;
    let private_key = (*key
        .to_openssh(Default::default())
        .map_err(|e| format!("Encoding private key failed: {}", e))?)
    .to_string();
    let public_key = key
        .public_key()
        .to_openssh()
        .map_err(|e| format!("Encoding public key failed: {}", e))?;
    let fingerprint = key
        .public_key()
        .fingerprint(russh::keys::HashAlg::Sha256)
        .to_string();

    Ok(GeneratedSshKey {
        private_key,
        public_key,
        fingerprint,
    })
}

#[tauri::command]
pub async fn write_session(
    pty_mgr: tauri::State<'_, PtySessionManager>,
    ssh_mgr: tauri::State<'_, SshSessionManager>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    if pty_mgr.has_session(&session_id) {
        pty_mgr.write(&session_id, &data)
    } else {
        ssh_mgr.write(&session_id, &data).await
    }
}

#[tauri::command]
pub async fn resize_session(
    pty_mgr: tauri::State<'_, PtySessionManager>,
    ssh_mgr: tauri::State<'_, SshSessionManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    if pty_mgr.has_session(&session_id) {
        pty_mgr.resize(&session_id, cols, rows)
    } else {
        ssh_mgr.resize(&session_id, cols, rows).await
    }
}

#[tauri::command]
pub async fn close_session(
    pty_mgr: tauri::State<'_, PtySessionManager>,
    ssh_mgr: tauri::State<'_, SshSessionManager>,
    session_id: String,
) -> Result<(), String> {
    if pty_mgr.has_session(&session_id) {
        pty_mgr.close(&session_id)
    } else {
        ssh_mgr.close(&session_id).await
    }
}
