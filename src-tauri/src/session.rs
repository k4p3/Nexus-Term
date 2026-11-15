use crate::pty::PtySessionManager;
use crate::ssh::SshSessionManager;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeneratedSshKey {
    pub private_key: String,
    pub public_key: String,
    pub fingerprint: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtractedKeyInfo {
    pub public_key: String,
    pub fingerprint: String,
    pub key_type: String,
}

#[tauri::command]
pub fn generate_ssh_key(algorithm: Option<String>) -> Result<GeneratedSshKey, String> {
    let alg = match algorithm.as_deref() {
        Some("rsa") => russh::keys::Algorithm::Rsa { hash: Some(russh::keys::HashAlg::Sha256) },
        _ => russh::keys::Algorithm::Ed25519,
    };
    let key = russh::keys::PrivateKey::random(&mut rand::rngs::OsRng, alg)
        .map_err(|e| format!("Failed to generate key: {}", e))?;
    let private_key = (*key
        .to_openssh(Default::default())
        .map_err(|e| format!("Encoding private key failed: {}", e))?)
    .to_string();
    let public_key = key
        .public_key()
        .to_openssh()
        .map_err(|e| format!("Encoding public key failed: {}", e))?;
    let fingerprint = key
        .public_key()
        .fingerprint(russh::keys::HashAlg::Sha256)
        .to_string();

    Ok(GeneratedSshKey {
        private_key,
        public_key,
        fingerprint,
    })
}

#[tauri::command]
pub fn extract_public_key(
    key_content: String,
    passphrase: Option<String>,
) -> Result<ExtractedKeyInfo, String> {
    let trimmed = key_content.trim();
    if trimmed.is_empty() {
        return Err("Key content is empty".to_string());
    }

    match russh::keys::decode_secret_key(trimmed, passphrase.as_deref()) {
        Ok(priv_key) => {
            let pub_key = priv_key
                .public_key()
                .to_openssh()
                .map_err(|e| format!("Failed to encode derived public key: {}", e))?;
            let fingerprint = priv_key
                .public_key()
                .fingerprint(russh::keys::HashAlg::Sha256)
                .to_string();
            let key_type = priv_key
                .public_key()
                .key_data()
                .algorithm()
                .as_str()
                .to_string();

            Ok(ExtractedKeyInfo {
                public_key: pub_key,
                fingerprint,
                key_type,
            })
        }
        Err(russh::keys::Error::KeyIsEncrypted) => Err("PASSPHRASE_REQUIRED".to_string()),
        Err(e) => {
            if let Ok(pub_key) = russh::keys::PublicKey::from_openssh(trimmed) {
                let public_key_str = pub_key
                    .to_openssh()
                    .map_err(|e| format!("Failed to format public key: {}", e))?;
                let fingerprint = pub_key
                    .fingerprint(russh::keys::HashAlg::Sha256)
                    .to_string();
                let key_type = pub_key.key_data().algorithm().as_str().to_string();

                Ok(ExtractedKeyInfo {
                    public_key: public_key_str,
                    fingerprint,
                    key_type,
                })
            } else {
                Err(format!("Could not decode key: {}", e))
            }
        }
    }
}

#[tauri::command]
pub async fn write_session(
    pty_mgr: tauri::State<'_, PtySessionManager>,
    ssh_mgr: tauri::State<'_, SshSessionManager>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    if pty_mgr.has_session(&session_id) {
        pty_mgr.write(&session_id, &data)
    } else {
        ssh_mgr.write(&session_id, &data).await
    }
}

#[tauri::command]
pub async fn resize_session(
    pty_mgr: tauri::State<'_, PtySessionManager>,
    ssh_mgr: tauri::State<'_, SshSessionManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    if pty_mgr.has_session(&session_id) {
        pty_mgr.resize(&session_id, cols, rows)
    } else {
        ssh_mgr.resize(&session_id, cols, rows).await
    }
}

#[tauri::command]
pub async fn close_session(
    pty_mgr: tauri::State<'_, PtySessionManager>,
    ssh_mgr: tauri::State<'_, SshSessionManager>,
    session_id: String,
) -> Result<(), String> {
    if pty_mgr.has_session(&session_id) {
        pty_mgr.close(&session_id)
    } else {
        ssh_mgr.close(&session_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_ed25519_and_rsa_keys() {
        let ed25519_res = generate_ssh_key(Some("ed25519".to_string())).unwrap();
        assert!(ed25519_res.private_key.contains("OPENSSH PRIVATE KEY"));
        assert!(ed25519_res.public_key.starts_with("ssh-ed25519 "));
        assert!(ed25519_res.fingerprint.starts_with("SHA256:"));

        let rsa_res = generate_ssh_key(Some("rsa".to_string())).unwrap();
        assert!(rsa_res.private_key.contains("OPENSSH PRIVATE KEY"));
        assert!(rsa_res.public_key.starts_with("ssh-rsa "));
        assert!(rsa_res.fingerprint.starts_with("SHA256:"));
    }

    #[test]
    fn test_extract_public_key_from_private_and_public() {
        // Generate an ed25519 key pair
        let keypair = generate_ssh_key(None).unwrap();

        // 1. Extract from private key text
        let extracted = extract_public_key(keypair.private_key.clone(), None).unwrap();
        assert_eq!(extracted.public_key, keypair.public_key);
        assert_eq!(extracted.fingerprint, keypair.fingerprint);
        assert_eq!(extracted.key_type, "ssh-ed25519");

        // 2. Extract from public key text
        let from_pub = extract_public_key(keypair.public_key.clone(), None).unwrap();
        assert_eq!(from_pub.public_key, keypair.public_key);
        assert_eq!(from_pub.fingerprint, keypair.fingerprint);
        assert_eq!(from_pub.key_type, "ssh-ed25519");

        // 3. Test empty input error
        assert!(extract_public_key("".to_string(), None).is_err());
    }
}
