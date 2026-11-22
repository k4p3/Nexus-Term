use thiserror::Error;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum Error {
    #[error("key derivation failed")]
    Kdf,
    #[error("decryption failed: wrong key or tampered data")]
    Decrypt,
    #[error("unsupported version or algorithm")]
    Unsupported,
    #[error("payload too large")]
    TooLarge,
    #[error("invalid key format")]
    BadFormat,
    #[error("checksum mismatch")]
    BadChecksum,
    #[error("wrapping not present in bundle")]
    MissingWrapping,
    #[error("invalid data: {0}")]
    Invalid(&'static str),
}

pub type Result<T> = std::result::Result<T, Error>;
