//! Transporte de bytes hacia el servidor gráfico: TCP directo o canal `direct-tcpip`
//! a través de un Jump Host SSH (reutiliza `create_authenticated_ssh_session`).

use super::error::RemoteDesktopError;
use crate::ssh::{create_authenticated_ssh_session, SshClientHandler};
use crate::vault::db::VaultManager;
use russh::client::Handle;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::net::TcpStream;

pub const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);

pub trait RdStream: AsyncRead + AsyncWrite + Unpin + Send {}
impl<T: AsyncRead + AsyncWrite + Unpin + Send> RdStream for T {}
pub type BoxedStream = Box<dyn RdStream>;

/// Flujo ya conectado más el recurso que debe vivir mientras dure (sesión del bastión).
pub struct Transport {
    pub stream: BoxedStream,
    /// Mantiene viva la sesión SSH del Jump Host durante toda la sesión gráfica.
    pub _jump_session: Option<Handle<SshClientHandler>>,
    pub via_jump: bool,
}

pub async fn open_transport(
    vault: Arc<VaultManager>,
    hostname: &str,
    port: u16,
    jump_host_id: Option<&str>,
) -> Result<Transport, RemoteDesktopError> {
    let target = format!("{}:{}", hostname, port);
    match jump_host_id {
        Some(jump_id) => {
            let jump = create_authenticated_ssh_session(vault, jump_id)
                .await
                .map_err(|e| RemoteDesktopError::Connection {
                    target: target.clone(),
                    reason: format!("Servidor de Salto (Bastion) falló: {}", e),
                })?;
            let channel = jump
                .channel_open_direct_tcpip(hostname, port as u32, "127.0.0.1", 0)
                .await
                .map_err(|e| RemoteDesktopError::Connection {
                    target: target.clone(),
                    reason: format!("direct-tcpip a través del Bastion falló: {}", e),
                })?;
            Ok(Transport {
                stream: Box::new(channel.into_stream()),
                _jump_session: Some(jump),
                via_jump: true,
            })
        }
        None => {
            let tcp = tokio::time::timeout(CONNECT_TIMEOUT, TcpStream::connect(&target))
                .await
                .map_err(|_| RemoteDesktopError::Connection {
                    target: target.clone(),
                    reason: "tiempo de espera agotado".into(),
                })?
                .map_err(|e| RemoteDesktopError::Connection {
                    target: target.clone(),
                    reason: e.to_string(),
                })?;
            let _ = tcp.set_nodelay(true);
            Ok(Transport {
                stream: Box::new(tcp),
                _jump_session: None,
                via_jump: false,
            })
        }
    }
}

/// `true` si conviene avisar de que VNC viaja sin cifrar (sin bastión y no loopback).
pub fn vnc_is_unencrypted(hostname: &str, via_jump: bool) -> bool {
    if via_jump {
        return false;
    }
    let h = hostname.trim().to_lowercase();
    !(h == "localhost" || h == "::1" || h.starts_with("127."))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    #[test]
    fn test_vnc_unencrypted_warning_rules() {
        assert!(vnc_is_unencrypted("192.168.1.10", false));
        assert!(vnc_is_unencrypted("server.example.com", false));
        assert!(!vnc_is_unencrypted("192.168.1.10", true));
        assert!(!vnc_is_unencrypted("127.0.0.1", false));
        assert!(!vnc_is_unencrypted("localhost", false));
    }

    #[tokio::test]
    async fn test_direct_transport_connects_and_echoes() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            let (mut s, _) = listener.accept().await.unwrap();
            let mut b = [0u8; 4];
            s.read_exact(&mut b).await.unwrap();
            s.write_all(&b).await.unwrap();
        });

        let conn = rusqlite::Connection::open_in_memory().unwrap();
        let vault = Arc::new(VaultManager::new(conn).unwrap());
        let mut t = open_transport(vault, "127.0.0.1", port, None).await.unwrap();
        assert!(!t.via_jump);
        t.stream.write_all(b"ping").await.unwrap();
        let mut out = [0u8; 4];
        t.stream.read_exact(&mut out).await.unwrap();
        assert_eq!(&out, b"ping");
    }

    #[tokio::test]
    async fn test_direct_transport_reports_connection_refused() {
        // Puerto cerrado: bind y soltar para obtener uno libre.
        let port = {
            let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
            l.local_addr().unwrap().port()
        };
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        let vault = Arc::new(VaultManager::new(conn).unwrap());
        let err = open_transport(vault, "127.0.0.1", port, None).await.err().unwrap();
        assert!(matches!(err, RemoteDesktopError::Connection { .. }));
        assert!(err.to_string().contains(&port.to_string()));
    }
}
