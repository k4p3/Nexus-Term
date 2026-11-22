//! Protocolo de sincronización de NexusTerm: sobre de registro cifrado, jerarquía de claves y paquete de
//! clave. No hace E/S de red; lo comparten la app y el servidor.
pub mod bundle;
pub mod envelope;
pub mod error;
pub mod keys;
pub mod kit;

pub use error::{Error, Result};
pub use keys::Key;
