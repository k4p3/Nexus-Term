//! Escritorio remoto gráfico (RDP / VNC).
//!
//! Cada sesión es una tarea Tokio que recibe `SessionCommand` por `mpsc` y emite frames
//! binarios (`frame.rs`) y eventos de ciclo de vida mediante sumideros inyectables
//! (así los protocolos se prueban sin Tauri).

pub mod error;
pub mod frame;
pub mod input;
pub mod manager;
pub mod rdp;
pub mod transport;
pub mod vnc;

use error::RemoteDesktopError;
use input::InputEvent;
use serde::Serialize;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};

/// Intervalo de volcado de rectángulos sucios (~60 Hz).
pub const FLUSH_INTERVAL_MS: u64 = 16;

#[derive(Debug)]
pub enum SessionCommand {
    Input(InputEvent),
    Resize { width: u16, height: u16 },
    CtrlAltDel,
    Clipboard(String),
    /// Respuesta del usuario al aviso de certificado RDP (`true` = aceptar).
    CertDecision(bool),
    Close,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SessionEvent {
    State { state: String },
    Clipboard { text: String },
    CertPrompt { fingerprint: String, changed: bool },
    Error { message: String },
}

/// Envía un frame binario al frontend. Devuelve `false` si el receptor ya no existe.
pub type FrameSink = Arc<dyn Fn(Vec<u8>) -> bool + Send + Sync>;
pub type EventSink = Arc<dyn Fn(SessionEvent) + Send + Sync>;

/// Adaptador que convierte cualquier flujo `Send` en `Send + Sync` (requisito de `vnc-rs`).
/// El acceso es siempre exclusivo (`&mut self`), por lo que no hay bloqueo real.
pub struct SyncStream<T>(std::sync::Mutex<T>);

impl<T> SyncStream<T> {
    pub fn new(inner: T) -> Self {
        Self(std::sync::Mutex::new(inner))
    }

    fn inner(&mut self) -> &mut T {
        self.0.get_mut().unwrap_or_else(|e| e.into_inner())
    }
}

impl<T: AsyncRead + Unpin> AsyncRead for SyncStream<T> {
    fn poll_read(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &mut ReadBuf<'_>) -> Poll<std::io::Result<()>> {
        Pin::new(self.get_mut().inner()).poll_read(cx, buf)
    }
}

impl<T: AsyncWrite + Unpin> AsyncWrite for SyncStream<T> {
    fn poll_write(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &[u8]) -> Poll<std::io::Result<usize>> {
        Pin::new(self.get_mut().inner()).poll_write(cx, buf)
    }
    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        Pin::new(self.get_mut().inner()).poll_flush(cx)
    }
    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        Pin::new(self.get_mut().inner()).poll_shutdown(cx)
    }
}

/// Credenciales descifradas, vivas solo durante el arranque de la sesión.
pub struct Credentials {
    pub username: String,
    pub password: zeroize::Zeroizing<String>,
    pub domain: Option<String>,
}

pub(crate) fn emit_state(events: &EventSink, state: &str) {
    events(SessionEvent::State { state: state.to_string() });
}

pub(crate) fn fail(events: &EventSink, err: &RemoteDesktopError) {
    events(SessionEvent::Error { message: err.to_string() });
    emit_state(events, "error");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[tokio::test]
    async fn test_sync_stream_passes_data_through() {
        let (a, b) = tokio::io::duplex(64);
        let mut a = SyncStream::new(a);
        let mut b = b;
        a.write_all(b"hola").await.unwrap();
        let mut buf = [0u8; 4];
        b.read_exact(&mut buf).await.unwrap();
        assert_eq!(&buf, b"hola");
        b.write_all(b"eco!").await.unwrap();
        a.read_exact(&mut buf).await.unwrap();
        assert_eq!(&buf, b"eco!");
    }

    #[test]
    fn test_session_event_serialization_is_tagged() {
        let json = serde_json::to_string(&SessionEvent::State { state: "connected".into() }).unwrap();
        assert_eq!(json, r#"{"type":"state","state":"connected"}"#);
        let json = serde_json::to_string(&SessionEvent::CertPrompt { fingerprint: "ab".into(), changed: true }).unwrap();
        assert!(json.contains(r#""changed":true"#));
    }
}
