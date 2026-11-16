use thiserror::Error;

/// Errores estructurados de las sesiones gráficas, serializables al frontend como texto.
/// Nunca incluyen credenciales.
#[derive(Error, Debug)]
pub enum RemoteDesktopError {
    #[error("Bóveda: {0}")]
    Vault(String),
    #[error("Host no encontrado")]
    HostNotFound,
    #[error("El host no usa un protocolo gráfico (rdp/vnc)")]
    UnsupportedProtocol,
    #[error("No se pudo conectar a {target}: {reason}")]
    Connection { target: String, reason: String },
    #[error("Fallo de autenticación: {0}")]
    Authentication(String),
    #[error("Error de protocolo: {0}")]
    Protocol(String),
    #[error("Certificado del servidor no confiable (huella {0})")]
    CertificateRejected(String),
    #[error("Sesión no encontrada")]
    SessionNotFound,
    #[error("La sesión ya está cerrada")]
    SessionClosed,
    #[error("Entrada inválida: {0}")]
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
        let e = RemoteDesktopError::Authentication("credenciales rechazadas".into());
        assert_eq!(
            serde_json::to_string(&e).unwrap(),
            "\"Fallo de autenticación: credenciales rechazadas\""
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
