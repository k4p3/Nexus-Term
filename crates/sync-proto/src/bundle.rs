//! Paquete de clave: la clave de la bóveda envuelta de forma independiente (contraseña+Secret Key y,
//! opcionalmente, clave de recuperación) más los parámetros del KDF.
use crate::keys::{b64, Auk, KdfParams, RecoveryKey, SecretKey};
use crate::{Error, Key, Result};
use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};

pub const BUNDLE_VERSION: u8 = 1;
pub const PWD: &str = "pwd";
pub const RECOVERY: &str = "recovery";
const NONCE_LEN: usize = 12;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Wrapping {
    pub id: String,
    #[serde(with = "b64")]
    pub ct: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct KeyBundle {
    pub v: u8,
    pub kdf: KdfParams,
    pub wrappings: Vec<Wrapping>,
}

fn aad(id: &str) -> Vec<u8> {
    format!("nexusterm/bundle/v1|{id}").into_bytes()
}

fn wrap(vault_key: &Key, wrap_key: &Key, id: &str) -> Result<Vec<u8>> {
    let cipher = Aes256Gcm::new_from_slice(&wrap_key.0).map_err(|_| Error::Kdf)?;
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce);
    let ct = cipher
        .encrypt(Nonce::from_slice(&nonce), Payload { msg: &vault_key.0, aad: &aad(id) })
        .map_err(|_| Error::Decrypt)?;
    let mut out = nonce.to_vec();
    out.extend_from_slice(&ct);
    Ok(out)
}

fn unwrap(blob: &[u8], wrap_key: &Key, id: &str) -> Result<Key> {
    if blob.len() < NONCE_LEN + 16 {
        return Err(Error::Invalid("wrapping"));
    }
    let cipher = Aes256Gcm::new_from_slice(&wrap_key.0).map_err(|_| Error::Kdf)?;
    let plain = cipher
        .decrypt(Nonce::from_slice(&blob[..NONCE_LEN]), Payload { msg: &blob[NONCE_LEN..], aad: &aad(id) })
        .map_err(|_| Error::Decrypt)?;
    if plain.len() != 32 {
        return Err(Error::Decrypt);
    }
    let mut k = [0u8; 32];
    k.copy_from_slice(&plain);
    Ok(Key(k))
}

impl KeyBundle {
    /// Crea un paquete con la envoltura `pwd` (contraseña + Secret Key).
    pub fn create(vault_key: &Key, password: &str, secret: &SecretKey, kdf: KdfParams) -> Result<Self> {
        let wrapping = Self::password_wrapping(vault_key, password, secret, &kdf)?;
        Ok(Self { v: BUNDLE_VERSION, kdf, wrappings: vec![wrapping] })
    }

    fn password_wrapping(vault_key: &Key, password: &str, secret: &SecretKey, kdf: &KdfParams) -> Result<Wrapping> {
        let auk = Auk::derive(password, secret, kdf)?;
        Ok(Wrapping { id: PWD.into(), ct: wrap(vault_key, &auk.wrap_key()?, PWD)? })
    }

    fn find(&self, id: &str) -> Result<&Wrapping> {
        self.wrappings.iter().find(|w| w.id == id).ok_or(Error::MissingWrapping)
    }

    fn check(&self) -> Result<()> {
        if self.v != BUNDLE_VERSION {
            return Err(Error::Unsupported);
        }
        Ok(())
    }

    pub fn has_recovery(&self) -> bool {
        self.wrappings.iter().any(|w| w.id == RECOVERY)
    }

    /// Recupera la clave de la bóveda en otro equipo (necesita contraseña y Secret Key).
    pub fn unwrap_with_password(&self, password: &str, secret: &SecretKey) -> Result<Key> {
        self.check()?;
        let auk = Auk::derive(password, secret, &self.kdf)?;
        unwrap(&self.find(PWD)?.ct, &auk.wrap_key()?, PWD)
    }

    /// Recupera la clave de la bóveda con la clave de recuperación.
    pub fn unwrap_with_recovery(&self, recovery: &RecoveryKey) -> Result<Key> {
        self.check()?;
        unwrap(&self.find(RECOVERY)?.ct, &recovery.wrap_key()?, RECOVERY)
    }

    /// Añade o rota la envoltura de recuperación.
    pub fn set_recovery(&mut self, vault_key: &Key, recovery: &RecoveryKey) -> Result<()> {
        let w = Wrapping { id: RECOVERY.into(), ct: wrap(vault_key, &recovery.wrap_key()?, RECOVERY)? };
        self.wrappings.retain(|x| x.id != RECOVERY);
        self.wrappings.push(w);
        Ok(())
    }

    /// Revoca la clave de recuperación.
    pub fn revoke_recovery(&mut self) {
        self.wrappings.retain(|x| x.id != RECOVERY);
    }

    /// Cambia la contraseña: solo se reescribe `pwd` (con sal nueva); los registros no se recifran.
    pub fn change_password(&mut self, vault_key: &Key, new_password: &str, secret: &SecretKey) -> Result<()> {
        let mut kdf = self.kdf.clone();
        let fresh = KdfParams::with_cost(kdf.m, kdf.t, kdf.p);
        kdf.salt = fresh.salt;
        let w = Self::password_wrapping(vault_key, new_password, secret, &kdf)?;
        self.kdf = kdf;
        self.wrappings.retain(|x| x.id != PWD);
        self.wrappings.push(w);
        Ok(())
    }

    /// Recupera con la clave de recuperación y fija una contraseña nueva en un solo paso.
    pub fn recover_and_set_password(&mut self, recovery: &RecoveryKey, new_password: &str, secret: &SecretKey) -> Result<Key> {
        let key = self.unwrap_with_recovery(recovery)?;
        self.change_password(&key, new_password, secret)?;
        Ok(key)
    }
}
