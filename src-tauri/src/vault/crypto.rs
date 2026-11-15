use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{
    Algorithm, Argon2, Params, Version,
};
use rand::{rngs::OsRng, RngCore};
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

pub const SALT_LEN: usize = 16;
pub const NONCE_LEN: usize = 12;
pub const KEY_LEN: usize = 32;

// Default Argon2id parameters: 64 MiB memory, 3 iterations, 4 parallelism
pub const DEFAULT_KDF_MEM_KIB: u32 = 64 * 1024;
pub const DEFAULT_KDF_ITERATIONS: u32 = 3;
pub const DEFAULT_KDF_PARALLELISM: u32 = 4;

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Argon2 derivation failed: {0}")]
    KdfError(String),
    #[error("Decryption failed: invalid password, wrong key or corrupted ciphertext")]
    DecryptionFailed,
    #[error("Invalid payload length: expected at least {0} bytes")]
    PayloadTooShort(usize),
}

/// Protected 256-bit symmetric key for encrypting vault records.
/// Memory is securely overwritten with zeros when dropped.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct VaultKey(pub [u8; KEY_LEN]);

impl VaultKey {
    /// Generate a cryptographically secure random 256-bit key
    pub fn generate_random() -> Self {
        let mut key = [0u8; KEY_LEN];
        OsRng.fill_bytes(&mut key);
        Self(key)
    }

    /// Access the key bytes securely
    pub fn as_bytes(&self) -> &[u8; KEY_LEN] {
        &self.0
    }
}

/// Derive a MasterKey (32 bytes) from the user's password using Argon2id.
pub fn derive_master_key(
    password: &str,
    salt: &[u8],
    mem_kib: u32,
    iterations: u32,
    parallelism: u32,
) -> Result<[u8; KEY_LEN], CryptoError> {
    let params = Params::new(mem_kib, iterations, parallelism, Some(KEY_LEN))
        .map_err(|e| CryptoError::KdfError(e.to_string()))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| CryptoError::KdfError(e.to_string()))?;

    Ok(key)
}

/// Encrypt (wrap) the VaultKey with a derived MasterKey using AES-256-GCM.
/// Format: [nonce (12B) || ciphertext || tag (16B)]
pub fn wrap_vault_key(vault_key: &VaultKey, master_key: &[u8; KEY_LEN]) -> Result<Vec<u8>, CryptoError> {
    let cipher = Aes256Gcm::new_from_slice(master_key)
        .map_err(|e| CryptoError::KdfError(e.to_string()))?;

    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted = cipher
        .encrypt(nonce, vault_key.as_bytes().as_ref())
        .map_err(|_| CryptoError::DecryptionFailed)?;

    let mut result = Vec::with_capacity(NONCE_LEN + encrypted.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&encrypted);
    Ok(result)
}

/// Decrypt (unwrap) the VaultKey using the derived MasterKey.
pub fn unwrap_vault_key(
    wrapped: &[u8],
    master_key: &[u8; KEY_LEN],
) -> Result<VaultKey, CryptoError> {
    if wrapped.len() < NONCE_LEN + 16 {
        return Err(CryptoError::PayloadTooShort(NONCE_LEN + 16));
    }

    let cipher = Aes256Gcm::new_from_slice(master_key)
        .map_err(|e| CryptoError::KdfError(e.to_string()))?;

    let nonce = Nonce::from_slice(&wrapped[..NONCE_LEN]);
    let ciphertext = &wrapped[NONCE_LEN..];

    let decrypted = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    if decrypted.len() != KEY_LEN {
        return Err(CryptoError::DecryptionFailed);
    }

    let mut key = [0u8; KEY_LEN];
    key.copy_from_slice(&decrypted);
    Ok(VaultKey(key))
}

/// Encrypt a record field (e.g. password, private key) using the active VaultKey.
/// Format: [nonce (12B) || ciphertext || tag (16B)]
pub fn encrypt_record(vault_key: &VaultKey, plaintext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let cipher = Aes256Gcm::new_from_slice(vault_key.as_bytes())
        .map_err(|e| CryptoError::KdfError(e.to_string()))?;

    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    let mut result = Vec::with_capacity(NONCE_LEN + encrypted.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&encrypted);
    Ok(result)
}

/// Decrypt a record field using the active VaultKey.
pub fn decrypt_record(vault_key: &VaultKey, payload: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if payload.len() < NONCE_LEN + 16 {
        return Err(CryptoError::PayloadTooShort(NONCE_LEN + 16));
    }

    let cipher = Aes256Gcm::new_from_slice(vault_key.as_bytes())
        .map_err(|e| CryptoError::KdfError(e.to_string()))?;

    let nonce = Nonce::from_slice(&payload[..NONCE_LEN]);
    let ciphertext = &payload[NONCE_LEN..];

    let decrypted = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    Ok(decrypted)
}

/// Generate a new random salt
pub fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    salt
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_and_unwrap_success() {
        let salt = generate_salt();
        let password = "SuperSecretPassword123!";
        // Use lower memory for faster unit tests
        let mem_kib = 1024;
        let iter = 1;
        let par = 1;

        let master_key = derive_master_key(password, &salt, mem_kib, iter, par).unwrap();
        let original_vault_key = VaultKey::generate_random();

        let wrapped = wrap_vault_key(&original_vault_key, &master_key).unwrap();
        assert!(wrapped.len() > NONCE_LEN);

        let unwrapped = unwrap_vault_key(&wrapped, &master_key).unwrap();
        assert_eq!(original_vault_key.as_bytes(), unwrapped.as_bytes());
    }

    #[test]
    fn test_unwrap_failure_wrong_password() {
        let salt = generate_salt();
        let password = "CorrectPassword!";
        let wrong_password = "WrongPassword!";
        let mem_kib = 1024;
        let iter = 1;
        let par = 1;

        let master_key = derive_master_key(password, &salt, mem_kib, iter, par).unwrap();
        let wrong_master_key = derive_master_key(wrong_password, &salt, mem_kib, iter, par).unwrap();

        let original_vault_key = VaultKey::generate_random();
        let wrapped = wrap_vault_key(&original_vault_key, &master_key).unwrap();

        let res = unwrap_vault_key(&wrapped, &wrong_master_key);
        assert!(res.is_err());
    }

    #[test]
    fn test_encrypt_decrypt_record() {
        let vault_key = VaultKey::generate_random();
        let secret_payload = b"id_ed25519-secret-private-key-data";

        let encrypted = encrypt_record(&vault_key, secret_payload).unwrap();
        assert_ne!(encrypted, secret_payload);

        let decrypted = decrypt_record(&vault_key, &encrypted).unwrap();
        assert_eq!(decrypted, secret_payload);
    }

    #[test]
    fn test_rotate_master_password() {
        let salt1 = generate_salt();
        let old_pwd = "OldPassword!";
        let mem_kib = 1024;
        let iter = 1;
        let par = 1;

        let master_key1 = derive_master_key(old_pwd, &salt1, mem_kib, iter, par).unwrap();
        let vault_key = VaultKey::generate_random();
        let wrapped1 = wrap_vault_key(&vault_key, &master_key1).unwrap();

        // Encrypt some record with vault_key
        let sensitive_data = b"production-database-password-456";
        let encrypted_record = encrypt_record(&vault_key, sensitive_data).unwrap();

        // Unwrap with old password
        let active_vault_key = unwrap_vault_key(&wrapped1, &master_key1).unwrap();

        // Rotate to new password:
        let new_pwd = "NewBrandPassword789!";
        let salt2 = generate_salt();
        let master_key2 = derive_master_key(new_pwd, &salt2, mem_kib, iter, par).unwrap();
        let wrapped2 = wrap_vault_key(&active_vault_key, &master_key2).unwrap();

        // Now verify unwrapping with new password gives back the same vault key
        let active_vault_key_after_rotation = unwrap_vault_key(&wrapped2, &master_key2).unwrap();
        assert_eq!(active_vault_key_after_rotation.as_bytes(), vault_key.as_bytes());

        // And verify that previously encrypted records decrypt perfectly with this key!
        let decrypted = decrypt_record(&active_vault_key_after_rotation, &encrypted_record).unwrap();
        assert_eq!(decrypted, sensitive_data);
    }
}
