//! Gestor de sesiones gráficas y comandos Tauri `rd_*`.

use super::error::RemoteDesktopError;
use super::input::{validate_clipboard_text, InputEvent};
use super::transport::{open_transport, vnc_is_unencrypted};
use super::{rdp, vnc, Credentials, EventSink, FrameSink, SessionCommand, SessionEvent};
use crate::vault::db::VaultManager;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, Mutex};
use zeroize::Zeroizing;

const COMMAND_QUEUE: usize = 256;

#[derive(Default)]
pub struct RemoteDesktopManager {
    sessions: Mutex<HashMap<String, mpsc::Sender<SessionCommand>>>,
}

#[derive(Debug, Serialize, Clone)]
pub struct RdConnectInfo {
    pub session_id: String,
    pub protocol: String,
    /// `true` si es VNC sin bastión ni loopback: el tráfico viaja sin cifrar.
    pub unencrypted_warning: bool,
}

impl RemoteDesktopManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// Registra la sesión; `false` si el id ya existe.
    async fn try_insert(&self, id: String, tx: mpsc::Sender<SessionCommand>) -> bool {
        let mut map = self.sessions.lock().await;
        if map.contains_key(&id) {
            return false;
        }
        map.insert(id, tx);
        true
    }

    async fn remove(&self, id: &str) {
        self.sessions.lock().await.remove(id);
    }

    pub async fn send(&self, id: &str, cmd: SessionCommand) -> Result<(), RemoteDesktopError> {
        let tx = self
            .sessions
            .lock()
            .await
            .get(id)
            .cloned()
            .ok_or(RemoteDesktopError::SessionNotFound)?;
        tx.send(cmd).await.map_err(|_| RemoteDesktopError::SessionClosed)
    }

    pub async fn session_count(&self) -> usize {
        self.sessions.lock().await.len()
    }
}

/// El frontend genera el id para suscribirse a los eventos antes de conectar (evita perder
/// los primeros). Se restringe a un alfabeto seguro porque forma parte del nombre del evento.
pub fn validate_session_id(id: &str) -> Result<(), RemoteDesktopError> {
    let ok = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if ok {
        Ok(())
    } else {
        Err(RemoteDesktopError::InvalidInput("Identificador de sesión inválido".into()))
    }
}

/// Datos del host resueltos desde la bóveda (las credenciales viven solo en memoria).
struct Resolved {
    protocol: String,
    hostname: String,
    port: u16,
    jump_host_id: Option<String>,
    credentials: Credentials,
    has_secret: bool,
}

fn resolve_host(vault: &VaultManager, host_id: &str) -> Result<Resolved, RemoteDesktopError> {
    let inv = vault.get_inventory().map_err(|e| RemoteDesktopError::Vault(e.to_string()))?;
    let host = inv
        .hosts
        .into_iter()
        .find(|h| h.id == host_id)
        .ok_or(RemoteDesktopError::HostNotFound)?;
    if host.protocol != "rdp" && host.protocol != "vnc" {
        return Err(RemoteDesktopError::UnsupportedProtocol);
    }
    let identity = match &host.identity_id {
        Some(id) => Some(
            vault
                .get_decrypted_identity(id)
                .map_err(|e| RemoteDesktopError::Vault(e.to_string()))?,
        ),
        None => None,
    };
    let username = host
        .username_override
        .clone()
        .or_else(|| identity.as_ref().map(|i| i.username.clone()))
        .unwrap_or_default();
    let secret = identity.and_then(|i| i.secret);
    let has_secret = secret.is_some();
    Ok(Resolved {
        protocol: host.protocol,
        hostname: host.hostname,
        port: host.port,
        jump_host_id: host.jump_host_id,
        credentials: Credentials {
            username,
            password: Zeroizing::new(secret.unwrap_or_default()),
            domain: host.rdp_domain,
        },
        has_secret,
    })
}

fn clipboard_enabled(vault: &VaultManager) -> bool {
    match vault.db.lock() {
        Ok(conn) => crate::settings::get_settings_internal(&conn)
            .map(|s| s.remote_desktop_clipboard)
            .unwrap_or(true),
        Err(_) => true,
    }
}

#[allow(clippy::too_many_arguments)] // los argumentos son el contrato IPC del comando
#[tauri::command]
pub async fn rd_connect(
    app: AppHandle,
    vault: State<'_, Arc<VaultManager>>,
    mgr: State<'_, Arc<RemoteDesktopManager>>,
    session_id: String,
    host_id: String,
    width: u16,
    height: u16,
    on_frame: Channel<InvokeResponseBody>,
) -> Result<RdConnectInfo, RemoteDesktopError> {
    validate_session_id(&session_id)?;
    let vault = vault.inner().clone();
    let mgr = mgr.inner().clone();
    let resolved = resolve_host(&vault, &host_id)?;
    let known_fp = if resolved.protocol == "rdp" {
        vault
            .get_rdp_cert_fingerprint(&host_id)
            .map_err(|e| RemoteDesktopError::Vault(e.to_string()))?
    } else {
        None
    };

    let (tx, rx) = mpsc::channel(COMMAND_QUEUE);
    if !mgr.try_insert(session_id.clone(), tx).await {
        return Err(RemoteDesktopError::InvalidInput("El identificador de sesión ya está en uso".into()));
    }

    let info = RdConnectInfo {
        session_id: session_id.clone(),
        protocol: resolved.protocol.clone(),
        unencrypted_warning: resolved.protocol == "vnc"
            && vnc_is_unencrypted(&resolved.hostname, resolved.jump_host_id.is_some()),
    };

    let event_name = format!("rd://{}/event", session_id);
    let clipboard_ok = clipboard_enabled(&vault);
    let frames: FrameSink = Arc::new(move |buf| on_frame.send(InvokeResponseBody::Raw(buf)).is_ok());
    let app_events = app.clone();
    let events: EventSink = Arc::new(move |ev| {
        // Con el portapapeles desactivado nunca se reenvía contenido remoto al frontend.
        if matches!(ev, SessionEvent::Clipboard { .. }) && !clipboard_ok {
            return;
        }
        let _ = app_events.emit(&event_name, ev);
    });

    let sid = session_id.clone();
    // Los futures de IronRDP (`connect_finalize` usa closures async) no cumplen `Send` de forma
    // general, así que la sesión corre con `block_on` en un hilo del pool bloqueante en lugar de
    // `tokio::spawn`. Cada sesión es de larga duración y ocupa un único hilo.
    let handle = tokio::runtime::Handle::current();
    tokio::task::spawn_blocking(move || {
        handle.block_on(async move {
            let outcome =
                run_session(vault, resolved, host_id, width, height, known_fp, rx, frames, events.clone()).await;
            if let Err(e) = outcome {
                tracing::warn!("Sesión gráfica {} terminó con error: {}", sid, e);
            }
            mgr.remove(&sid).await;
        })
    });

    Ok(info)
}

#[allow(clippy::too_many_arguments)]
async fn run_session(
    vault: Arc<VaultManager>,
    resolved: Resolved,
    host_id: String,
    width: u16,
    height: u16,
    known_fp: Option<String>,
    rx: mpsc::Receiver<SessionCommand>,
    frames: FrameSink,
    events: EventSink,
) -> Result<(), RemoteDesktopError> {
    super::emit_state(&events, "connecting");
    let transport = match open_transport(
        vault.clone(),
        &resolved.hostname,
        resolved.port,
        resolved.jump_host_id.as_deref(),
    )
    .await
    {
        Ok(t) => t,
        Err(e) => {
            super::fail(&events, &e);
            return Err(e);
        }
    };
    // Mantiene viva la sesión del bastión mientras dure la sesión gráfica.
    let _keepalive = transport._jump_session;
    let stream = transport.stream;

    if resolved.protocol == "rdp" {
        let store_vault = vault.clone();
        let store_host = host_id.clone();
        let params = rdp::RdpParams {
            hostname: resolved.hostname,
            credentials: resolved.credentials,
            width,
            height,
            known_fingerprint: known_fp,
            store_fingerprint: Arc::new(move |fp| {
                if let Err(e) = store_vault.accept_rdp_cert_fingerprint(&store_host, fp) {
                    tracing::warn!("No se pudo guardar la huella del certificado: {}", e);
                }
            }),
        };
        rdp::run(stream, params, rx, frames, events).await
    } else {
        let password = if resolved.has_secret { Some(resolved.credentials.password) } else { None };
        vnc::run(stream, password, rx, frames, events).await
    }
}

#[tauri::command]
pub async fn rd_send_input(
    mgr: State<'_, Arc<RemoteDesktopManager>>,
    session_id: String,
    event: InputEvent,
) -> Result<(), RemoteDesktopError> {
    event.validate()?;
    mgr.send(&session_id, SessionCommand::Input(event)).await
}

#[tauri::command]
pub async fn rd_resize(
    mgr: State<'_, Arc<RemoteDesktopManager>>,
    session_id: String,
    width: u16,
    height: u16,
) -> Result<(), RemoteDesktopError> {
    mgr.send(&session_id, SessionCommand::Resize { width, height }).await
}

#[tauri::command]
pub async fn rd_send_cad(
    mgr: State<'_, Arc<RemoteDesktopManager>>,
    session_id: String,
) -> Result<(), RemoteDesktopError> {
    mgr.send(&session_id, SessionCommand::CtrlAltDel).await
}

#[tauri::command]
pub async fn rd_set_clipboard(
    vault: State<'_, Arc<VaultManager>>,
    mgr: State<'_, Arc<RemoteDesktopManager>>,
    session_id: String,
    text: String,
) -> Result<(), RemoteDesktopError> {
    if !clipboard_enabled(&vault) {
        return Err(RemoteDesktopError::InvalidInput("El portapapeles está desactivado en Ajustes".into()));
    }
    validate_clipboard_text(&text)?;
    mgr.send(&session_id, SessionCommand::Clipboard(text)).await
}

#[tauri::command]
pub async fn rd_accept_cert(
    mgr: State<'_, Arc<RemoteDesktopManager>>,
    session_id: String,
    accept: bool,
) -> Result<(), RemoteDesktopError> {
    mgr.send(&session_id, SessionCommand::CertDecision(accept)).await
}

#[tauri::command]
pub async fn rd_disconnect(
    mgr: State<'_, Arc<RemoteDesktopManager>>,
    session_id: String,
) -> Result<(), RemoteDesktopError> {
    // Si la sesión ya terminó, desconectar es idempotente.
    match mgr.send(&session_id, SessionCommand::Close).await {
        Ok(()) | Err(RemoteDesktopError::SessionNotFound) | Err(RemoteDesktopError::SessionClosed) => Ok(()),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::inventory::{SaveHostPayload, SaveIdentityPayload};
    use rusqlite::Connection;

    fn unlocked_vault() -> VaultManager {
        let vault = VaultManager::new(Connection::open_in_memory().unwrap()).unwrap();
        vault.init("VaultMasterPass!2026").unwrap();
        vault
    }

    fn host(protocol: &str, identity_id: Option<String>) -> SaveHostPayload {
        SaveHostPayload {
            id: None,
            folder_id: None,
            jump_host_id: None,
            protocol: protocol.to_string(),
            rdp_domain: Some("CORP".into()),
            label: "pc".into(),
            hostname: "10.1.1.1".into(),
            port: 0,
            username_override: None,
            identity_id,
            tags: vec![],
            notes: None,
        }
    }

    fn password_identity(vault: &VaultManager) -> String {
        vault
            .save_identity(SaveIdentityPayload {
                id: None,
                name: "win".into(),
                username: "Administrator".into(),
                auth_type: "password".into(),
                public_key: None,
                secret: Some("TopSecret!".into()),
                passphrase: None,
            })
            .unwrap()
    }

    #[test]
    fn test_resolve_host_decrypts_credentials_in_memory() {
        let vault = unlocked_vault();
        let ident = password_identity(&vault);
        let id = vault.save_host(host("rdp", Some(ident))).unwrap();
        let r = resolve_host(&vault, &id).unwrap();
        assert_eq!(r.protocol, "rdp");
        assert_eq!(r.port, 3389);
        assert_eq!(r.credentials.username, "Administrator");
        assert_eq!(r.credentials.password.as_str(), "TopSecret!");
        assert_eq!(r.credentials.domain.as_deref(), Some("CORP"));
        assert!(r.has_secret);
    }

    #[test]
    fn test_resolve_host_rejects_ssh_and_missing_hosts() {
        let vault = unlocked_vault();
        let ssh = vault.save_host(host("ssh", None)).unwrap();
        assert!(matches!(resolve_host(&vault, &ssh), Err(RemoteDesktopError::UnsupportedProtocol)));
        assert!(matches!(resolve_host(&vault, "nope"), Err(RemoteDesktopError::HostNotFound)));
    }

    #[test]
    fn test_resolve_host_fails_when_vault_locked() {
        let vault = unlocked_vault();
        let id = vault.save_host(host("vnc", None)).unwrap();
        vault.lock();
        assert!(matches!(resolve_host(&vault, &id), Err(RemoteDesktopError::Vault(_))));
    }

    #[test]
    fn test_vnc_without_identity_has_no_secret() {
        let vault = unlocked_vault();
        let id = vault.save_host(host("vnc", None)).unwrap();
        let r = resolve_host(&vault, &id).unwrap();
        assert!(!r.has_secret);
        assert_eq!(r.port, 5900);
    }

    #[test]
    fn test_clipboard_setting_reads_from_vault() {
        let vault = unlocked_vault();
        assert!(clipboard_enabled(&vault));
        {
            let conn = vault.db.lock().unwrap();
            let mut s = crate::settings::get_settings_internal(&conn).unwrap();
            s.remote_desktop_clipboard = false;
            crate::settings::save_settings_internal(&conn, &s).unwrap();
        }
        assert!(!clipboard_enabled(&vault));
    }

    #[tokio::test]
    async fn test_manager_routes_commands_and_reports_missing_sessions() {
        let mgr = RemoteDesktopManager::new();
        assert!(matches!(
            mgr.send("x", SessionCommand::Close).await,
            Err(RemoteDesktopError::SessionNotFound)
        ));
        let (tx, mut rx) = mpsc::channel(4);
        assert!(mgr.try_insert("s1".into(), tx).await);
        let (dup_tx, _dup_rx) = mpsc::channel(1);
        assert!(!mgr.try_insert("s1".into(), dup_tx).await);
        assert_eq!(mgr.session_count().await, 1);
        mgr.send("s1", SessionCommand::CtrlAltDel).await.unwrap();
        assert!(matches!(rx.recv().await, Some(SessionCommand::CtrlAltDel)));
        drop(rx);
        assert!(matches!(
            mgr.send("s1", SessionCommand::Close).await,
            Err(RemoteDesktopError::SessionClosed)
        ));
        mgr.remove("s1").await;
        assert_eq!(mgr.session_count().await, 0);
    }

    #[test]
    fn test_session_id_validation() {
        assert!(validate_session_id("rd-1a2b_3C").is_ok());
        assert!(validate_session_id("").is_err());
        assert!(validate_session_id("con espacio").is_err());
        assert!(validate_session_id("a/b").is_err());
        assert!(validate_session_id(&"x".repeat(65)).is_err());
    }
}
