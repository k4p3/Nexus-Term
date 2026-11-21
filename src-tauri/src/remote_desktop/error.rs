use thiserror::Error;

/// Errores estructurados de las sesiones gráficas, serializables al frontend como texto.
/// Nunca incluyen credenciales.
#[derive(Error, Debug)]
pub enum RemoteDesktopError {
    #[error("Vault: {0}")]
    Vault(String),
    #[error("Host not found")]
    HostNotFound,
    #[error("The host does not use a graphical protocol (rdp/vnc)")]
    UnsupportedProtocol,
    #[error("Could not connect to {target}: {reason}")]
    Connection { target: String, reason: String },
    #[error("Authentication failed: {0}")]
    Authentication(String),
    #[error("Protocol error: {0}")]
    Protocol(String),
    #[error("Untrusted server certificate (fingerprint {0})")]
    CertificateRejected(String),
    #[error("Session not found")]
    SessionNotFound,
    #[error("The session is already closed")]
    SessionClosed,
    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl serde::Serialize for RemoteDesktopError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_serializes_as_plain_string() {
        let e = RemoteDesktopError::Authentication("credentials rejected".into());
        assert_eq!(
            serde_json::to_string(&e).unwrap(),
            "\"Authentication failed: credentials rejected\""
        );
    }

    #[test]
    fn test_connection_error_mentions_target() {
        let e = RemoteDesktopError::Connection {
            target: "10.0.0.5:3389".into(),
            reason: "timeout".into(),
        };
        assert!(e.to_string().contains("10.0.0.5:3389"));
    }
}
