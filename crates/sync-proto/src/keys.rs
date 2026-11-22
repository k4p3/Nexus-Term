//! Secret Key, Recovery Key, AUK y claves derivadas.
use crate::{Error, Result};
use argon2::{Algorithm, Argon2, Params, Version};
use data_encoding::BASE32_NOPAD;
use hkdf::Hkdf;
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zeroize::{Zeroize, ZeroizeOnDrop};

pub const KEY_LEN: usize = 32;
pub const SECRET_KEY_PREFIX: &str = "NXT1";
pub const RECOVERY_KEY_PREFIX: &str = "NXR1";
const HKDF_SALT: &[u8] = b"nexusterm/sync/v1";

/// Clave simétrica de 256 bits que se borra de memoria al soltarse.
#[derive(Clone, Zeroize, ZeroizeOnDrop, PartialEq, Eq)]
pub struct Key(pub [u8; KEY_LEN]);

impl Key {
    pub fn generate() -> Self {
        let mut k = [0u8; KEY_LEN];
        OsRng.fill_bytes(&mut k);
        Key(k)
    }
}

impl std::fmt::Debug for Key {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Key(<redacted>)")
    }
}

fn checksum(prefix: &str, bytes: &[u8]) -> [u8; 2] {
    let mut h = Sha256::new();
    h.update(prefix.as_bytes());
    h.update(bytes);
    let d = h.finalize();
    [d[0], d[1]]
}

/// `PREFIJO-XXXXX-XXXXX-…` (base32 sin relleno, grupos de 5) con 2 bytes de suma de comprobación.
fn encode(prefix: &str, bytes: &[u8]) -> String {
    let mut data = bytes.to_vec();
    data.extend_from_slice(&checksum(prefix, bytes));
    let b32 = BASE32_NOPAD.encode(&data);
    let groups: Vec<&str> = b32.as_bytes().chunks(5).map(|c| std::str::from_utf8(c).unwrap_or("")).collect();
    format!("{prefix}-{}", groups.join("-"))
}

fn decode(prefix: &str, text: &str, len: usize) -> Result<Vec<u8>> {
    let norm: String = text.chars().filter(|c| !c.is_whitespace() && *c != '-').collect::<String>().to_uppercase();
    let rest = norm.strip_prefix(prefix).ok_or(Error::BadFormat)?;
    let data = BASE32_NOPAD.decode(rest.as_bytes()).map_err(|_| Error::BadFormat)?;
    if data.len() != len + 2 {
        return Err(Error::BadFormat);
    }
    let (bytes, sum) = data.split_at(len);
    if checksum(prefix, bytes) != [sum[0], sum[1]] {
        return Err(Error::BadChecksum);
    }
    Ok(bytes.to_vec())
}

/// Secret Key: 128 bits que se guardan aparte de la contraseña (kit de emergencia).
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SecretKey(pub [u8; 16]);

impl SecretKey {
    pub fn generate() -> Self {
        let mut k = [0u8; 16];
        OsRng.fill_bytes(&mut k);
        SecretKey(k)
    }
    pub fn to_display(&self) -> String {
        encode(SECRET_KEY_PREFIX, &self.0)
    }
    pub fn parse(text: &str) -> Result<Self> {
        let v = decode(SECRET_KEY_PREFIX, text, 16)?;
        let mut k = [0u8; 16];
        k.copy_from_slice(&v);
        Ok(SecretKey(k))
    }
}

/// Clave de recuperación: 256 bits que envuelven una copia independiente de la clave de la bóveda.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct RecoveryKey(pub [u8; 32]);

impl RecoveryKey {
    pub fn generate() -> Self {
        let mut k = [0u8; 32];
        OsRng.fill_bytes(&mut k);
        RecoveryKey(k)
    }
    pub fn to_display(&self) -> String {
        encode(RECOVERY_KEY_PREFIX, &self.0)
    }
    pub fn parse(text: &str) -> Result<Self> {
        let v = decode(RECOVERY_KEY_PREFIX, text, 32)?;
        let mut k = [0u8; 32];
        k.copy_from_slice(&v);
        Ok(RecoveryKey(k))
    }
    /// Clave de envoltura. Sin Argon2id: ya tiene 256 bits de entropía.
    pub fn wrap_key(&self) -> Result<Key> {
        expand(&self.0, "recovery")
    }
}

/// Parámetros del KDF; viajan en el paquete de clave para poder endurecerlos después.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct KdfParams {
    pub alg: String,
    pub m: u32,
    pub t: u32,
    pub p: u32,
    #[serde(with = "b64")]
    pub salt: Vec<u8>,
}

pub mod b64 {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(v: &[u8], s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&STANDARD.encode(v))
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<u8>, D::Error> {
        let s = String::deserialize(d)?;
        STANDARD.decode(s).map_err(serde::de::Error::custom)
    }
}

impl KdfParams {
    pub const ALG: &'static str = "argon2id";

    /// 64 MiB, 3 iteraciones, 4 hilos (igual que la bóveda local) y sal nueva.
    pub fn new_default() -> Self {
        Self::with_cost(64 * 1024, 3, 4)
    }
    pub fn with_cost(m: u32, t: u32, p: u32) -> Self {
        let mut salt = vec![0u8; 16];
        OsRng.fill_bytes(&mut salt);
        Self { alg: Self::ALG.into(), m, t, p, salt }
    }
}

fn expand(prk_material: &[u8], info: &str) -> Result<Key> {
    let hk = Hkdf::<Sha256>::new(Some(HKDF_SALT), prk_material);
    let mut out = [0u8; KEY_LEN];
    hk.expand(info.as_bytes(), &mut out).map_err(|_| Error::Kdf)?;
    Ok(Key(out))
}

/// Clave raíz de la cuenta de sincronización.
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct Auk(Key);

impl Auk {
    /// `AUK = HKDF(Argon2id(contraseña, sal) ‖ Secret Key)`.
    pub fn derive(password: &str, secret: &SecretKey, kdf: &KdfParams) -> Result<Self> {
        if kdf.alg != KdfParams::ALG {
            return Err(Error::Unsupported);
        }
        let params = Params::new(kdf.m, kdf.t, kdf.p, Some(KEY_LEN)).map_err(|_| Error::Kdf)?;
        let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
        let mut out = [0u8; KEY_LEN];
        argon.hash_password_into(password.as_bytes(), &kdf.salt, &mut out).map_err(|_| Error::Kdf)?;
        let mut ikm = Vec::with_capacity(KEY_LEN + 16);
        ikm.extend_from_slice(&out);
        ikm.extend_from_slice(&secret.0);
        out.zeroize();
        let key = expand(&ikm, "auk");
        ikm.zeroize();
        Ok(Auk(key?))
    }
    /// Clave que se envía al servidor para autenticarse (el servidor guarda su hash).
    pub fn auth_key(&self) -> Result<Key> {
        expand(&(self.0).0, "auth")
    }
    /// Clave que envuelve la clave de la bóveda en el paquete.
    pub fn wrap_key(&self) -> Result<Key> {
        expand(&(self.0).0, "wrap")
    }
}
