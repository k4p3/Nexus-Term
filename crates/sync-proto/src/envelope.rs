//! Sobre de registro cifrado (AES-256-GCM). Solo `id`, `kind`, `rev`, `updated_at` y `deleted` van en claro.
use crate::{Error, Key, Result};
use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};

pub const ENVELOPE_VERSION: u8 = 1;
pub const ALG: &str = "A256GCM";
pub const MAX_PLAINTEXT: usize = 1024 * 1024;
const NONCE_LEN: usize = 12;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Envelope {
    pub v: u8,
    pub alg: String,
    pub kind: String,
    pub id: String,
    pub rev: u64,
    pub updated_at: String,
    pub deleted: bool,
    /// Nonce (base64).
    pub n: String,
    /// Texto cifrado + etiqueta (base64).
    pub ct: String,
}

/// El AAD liga el cifrado a `kind|id|rev|deleted`: el servidor no puede reordenar, sustituir ni marcar
/// como borrado un registro sin que la apertura falle.
fn aad(kind: &str, id: &str, rev: u64, deleted: bool) -> Vec<u8> {
    format!("nexusterm/env/v1|{kind}|{id}|{rev}|{}", deleted as u8).into_bytes()
}

fn seal_inner(key: &Key, kind: &str, id: &str, rev: u64, updated_at: &str, deleted: bool, plaintext: &[u8]) -> Result<Envelope> {
    if plaintext.len() > MAX_PLAINTEXT {
        return Err(Error::TooLarge);
    }
    let cipher = Aes256Gcm::new_from_slice(&key.0).map_err(|_| Error::Kdf)?;
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce);
    let ct = cipher
        .encrypt(Nonce::from_slice(&nonce), Payload { msg: plaintext, aad: &aad(kind, id, rev, deleted) })
        .map_err(|_| Error::Decrypt)?;
    Ok(Envelope {
        v: ENVELOPE_VERSION,
        alg: ALG.into(),
        kind: kind.into(),
        id: id.into(),
        rev,
        updated_at: updated_at.into(),
        deleted,
        n: STANDARD.encode(nonce),
        ct: STANDARD.encode(ct),
    })
}

impl Envelope {
    /// Cifra el registro completo (JSON ya serializado por el llamador).
    pub fn seal(key: &Key, kind: &str, id: &str, rev: u64, updated_at: &str, plaintext: &[u8]) -> Result<Self> {
        seal_inner(key, kind, id, rev, updated_at, false, plaintext)
    }

    /// Tombstone: no lleva contenido, pero está autenticado igual que un registro.
    pub fn seal_tombstone(key: &Key, kind: &str, id: &str, rev: u64, updated_at: &str) -> Result<Self> {
        seal_inner(key, kind, id, rev, updated_at, true, b"")
    }

    /// Autentica y descifra. Falla ante versión/algoritmo desconocidos, clave errónea o cualquier manipulación.
    pub fn open(&self, key: &Key) -> Result<Vec<u8>> {
        if self.v != ENVELOPE_VERSION || self.alg != ALG {
            return Err(Error::Unsupported);
        }
        let nonce = STANDARD.decode(&self.n).map_err(|_| Error::Invalid("nonce"))?;
        if nonce.len() != NONCE_LEN {
            return Err(Error::Invalid("nonce"));
        }
        let ct = STANDARD.decode(&self.ct).map_err(|_| Error::Invalid("ciphertext"))?;
        if ct.len() > MAX_PLAINTEXT + 16 {
            return Err(Error::TooLarge);
        }
        let cipher = Aes256Gcm::new_from_slice(&key.0).map_err(|_| Error::Kdf)?;
        cipher
            .decrypt(
                Nonce::from_slice(&nonce),
                Payload { msg: &ct, aad: &aad(&self.kind, &self.id, self.rev, self.deleted) },
            )
            .map_err(|_| Error::Decrypt)
    }
}
