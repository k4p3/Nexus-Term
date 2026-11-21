use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

use super::crypto::{decrypt_record, encrypt_record};
use super::db::{VaultError, VaultManager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Folder {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: i32,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IdentitySummary {
    pub id: String,
    pub name: String,
    pub username: String,
    pub auth_type: String, // "password" | "private_key" | "agent"
    pub public_key: Option<String>,
    pub has_secret: bool,
    pub has_passphrase: bool,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DecryptedIdentity {
    pub id: String,
    pub name: String,
    pub username: String,
    pub auth_type: String,
    pub public_key: Option<String>,
    pub secret: Option<String>,
    pub passphrase: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SaveIdentityPayload {
    pub id: Option<String>,
    pub name: String,
    pub username: String,
    pub auth_type: String,
    pub public_key: Option<String>,
    pub secret: Option<String>,
    pub passphrase: Option<String>,
}

pub const PROTOCOLS: [&str; 3] = ["ssh", "rdp", "vnc"];

pub fn default_protocol() -> String {
    "ssh".to_string()
}

/// Puerto por defecto de cada protocolo (22 / 3389 / 5900).
pub fn default_port_for(protocol: &str) -> u16 {
    match protocol {
        "rdp" => 3389,
        "vnc" => 5900,
        _ => 22,
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HostSummary {
    pub id: String,
    pub folder_id: Option<String>,
    pub jump_host_id: Option<String>,
    #[serde(default = "default_protocol")]
    pub protocol: String,
    #[serde(default)]
    pub rdp_domain: Option<String>,
    pub label: String,
    pub hostname: String,
    pub port: u16,
    pub username_override: Option<String>,
    pub identity_id: Option<String>,
    pub tags: Vec<String>,
    pub notes: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SaveHostPayload {
    pub id: Option<String>,
    pub folder_id: Option<String>,
    pub jump_host_id: Option<String>,
    #[serde(default = "default_protocol")]
    pub protocol: String,
    #[serde(default)]
    pub rdp_domain: Option<String>,
    pub label: String,
    pub hostname: String,
    pub port: u16,
    pub username_override: Option<String>,
    pub identity_id: Option<String>,
    pub tags: Vec<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InventoryData {
    pub folders: Vec<Folder>,
    pub identities: Vec<IdentitySummary>,
    pub hosts: Vec<HostSummary>,
}

impl VaultManager {
    pub fn get_inventory(&self) -> Result<InventoryData, VaultError> {
        let vault_key = self.get_active_vault_key()?;
        let conn = self.db.lock().unwrap();

        // 1. Folders
        let mut stmt = conn.prepare("SELECT id, parent_id, name, icon, color, sort_order, updated_at FROM folders ORDER BY sort_order ASC, name ASC")?;
        let folders = stmt
            .query_map([], |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    parent_id: row.get(1)?,
                    name: row.get(2)?,
                    icon: row.get(3)?,
                    color: row.get(4)?,
                    sort_order: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        // 2. Identities
        let mut stmt = conn.prepare("SELECT id, name, username, auth_type, encrypted_secret, encrypted_passphrase, public_key, updated_at FROM identities ORDER BY name ASC")?;
        let identities = stmt
            .query_map([], |row| {
                let enc_sec: Option<Vec<u8>> = row.get(4)?;
                let enc_pass: Option<Vec<u8>> = row.get(5)?;
                Ok(IdentitySummary {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    username: row.get(2)?,
                    auth_type: row.get(3)?,
                    public_key: row.get(6)?,
                    has_secret: enc_sec.is_some(),
                    has_passphrase: enc_pass.is_some(),
                    updated_at: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        // 3. Hosts
        let mut stmt = conn.prepare("SELECT id, folder_id, label, hostname, port, username_override, identity_id, tags_json, encrypted_notes, jump_host_id, updated_at, protocol, rdp_domain FROM hosts ORDER BY label ASC")?;
        let hosts = stmt
            .query_map([], |row| {
                let tags_str: String = row.get(7)?;
                let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
                let enc_notes: Option<Vec<u8>> = row.get(8)?;
                let notes = if let Some(blob) = enc_notes {
                    decrypt_record(&vault_key, &blob)
                        .ok()
                        .and_then(|bytes| String::from_utf8(bytes).ok())
                } else {
                    None
                };

                Ok(HostSummary {
                    id: row.get(0)?,
                    folder_id: row.get(1)?,
                    jump_host_id: row.get(9)?,
                    protocol: row.get(11)?,
                    rdp_domain: row.get(12)?,
                    label: row.get(2)?,
                    hostname: row.get(3)?,
                    port: row.get::<_, u32>(4)? as u16,
                    username_override: row.get(5)?,
                    identity_id: row.get(6)?,
                    tags,
                    notes,
                    updated_at: row.get(10)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(InventoryData {
            folders,
            identities,
            hosts,
        })
    }

    pub fn save_folder(&self, folder: Folder) -> Result<String, VaultError> {
        let _ = self.get_active_vault_key()?;
        let conn = self.db.lock().unwrap();
        let id = if folder.id.is_empty() {
            Uuid::now_v7().to_string()
        } else {
            folder.id
        };
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO folders (id, parent_id, name, icon, color, sort_order, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                parent_id = excluded.parent_id,
                name = excluded.name,
                icon = excluded.icon,
                color = excluded.color,
                sort_order = excluded.sort_order,
                updated_at = excluded.updated_at",
            params![
                id,
                folder.parent_id,
                folder.name,
                folder.icon,
                folder.color,
                folder.sort_order,
                now
            ],
        )?;

        Ok(id)
    }

    pub fn delete_folder(&self, id: &str) -> Result<(), VaultError> {
        let _ = self.get_active_vault_key()?;
        let conn = self.db.lock().unwrap();
        conn.execute("DELETE FROM folders WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn save_identity(&self, payload: SaveIdentityPayload) -> Result<String, VaultError> {
        let vault_key = self.get_active_vault_key()?;
        let conn = self.db.lock().unwrap();
        let id = payload
            .id
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| Uuid::now_v7().to_string());
        let now = Utc::now().to_rfc3339();

        let enc_secret = if let Some(secret) = &payload.secret {
            Some(encrypt_record(&vault_key, secret.as_bytes())?)
        } else {
            // Keep existing secret if not provided in update
            conn.query_row(
                "SELECT encrypted_secret FROM identities WHERE id = ?1",
                params![id],
                |row| row.get::<_, Option<Vec<u8>>>(0),
            )
            .unwrap_or(None)
        };

        let enc_passphrase = if let Some(passphrase) = &payload.passphrase {
            Some(encrypt_record(&vault_key, passphrase.as_bytes())?)
        } else {
            conn.query_row(
                "SELECT encrypted_passphrase FROM identities WHERE id = ?1",
                params![id],
                |row| row.get::<_, Option<Vec<u8>>>(0),
            )
            .unwrap_or(None)
        };

        let public_key = if let Some(pk) = payload.public_key.filter(|s| !s.trim().is_empty()) {
            Some(pk.trim().to_string())
        } else if payload.auth_type == "private_key" {
            if let Some(secret) = &payload.secret {
                russh::keys::decode_secret_key(secret, payload.passphrase.as_deref())
                    .ok()
                    .and_then(|k| k.public_key().to_openssh().ok())
            } else {
                conn.query_row(
                    "SELECT public_key FROM identities WHERE id = ?1",
                    params![id],
                    |row| row.get::<_, Option<String>>(0),
                )
                .unwrap_or(None)
            }
        } else {
            conn.query_row(
                "SELECT public_key FROM identities WHERE id = ?1",
                params![id],
                |row| row.get::<_, Option<String>>(0),
            )
            .unwrap_or(None)
        };

        conn.execute(
            "INSERT INTO identities (id, name, username, auth_type, encrypted_secret, encrypted_passphrase, public_key, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                username = excluded.username,
                auth_type = excluded.auth_type,
                encrypted_secret = excluded.encrypted_secret,
                encrypted_passphrase = excluded.encrypted_passphrase,
                public_key = excluded.public_key,
                updated_at = excluded.updated_at",
            params![
                id,
                payload.name,
                payload.username,
                payload.auth_type,
                enc_secret,
                enc_passphrase,
                public_key,
                now
            ],
        )?;

        Ok(id)
    }

    pub fn delete_identity(&self, id: &str) -> Result<(), VaultError> {
        let _ = self.get_active_vault_key()?;
        let conn = self.db.lock().unwrap();
        conn.execute("DELETE FROM identities WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_decrypted_identity(&self, id: &str) -> Result<DecryptedIdentity, VaultError> {
        let vault_key = self.get_active_vault_key()?;
        let conn = self.db.lock().unwrap();

        let (name, username, auth_type, enc_sec, enc_pass, public_key) = conn.query_row(
            "SELECT name, username, auth_type, encrypted_secret, encrypted_passphrase, public_key FROM identities WHERE id = ?1",
            params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<Vec<u8>>>(3)?,
                    row.get::<_, Option<Vec<u8>>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            },
        )?;

        let secret = if let Some(blob) = enc_sec {
            Some(String::from_utf8(decrypt_record(&vault_key, &blob)?).map_err(|_| VaultError::Crypto(super::crypto::CryptoError::DecryptionFailed))?)
        } else {
            None
        };

        let passphrase = if let Some(blob) = enc_pass {
            Some(String::from_utf8(decrypt_record(&vault_key, &blob)?).map_err(|_| VaultError::Crypto(super::crypto::CryptoError::DecryptionFailed))?)
        } else {
            None
        };

        Ok(DecryptedIdentity {
            id: id.to_string(),
            name,
            username,
            auth_type,
            public_key,
            secret,
            passphrase,
        })
    }

    pub fn save_host(&self, payload: SaveHostPayload) -> Result<String, VaultError> {
        let vault_key = self.get_active_vault_key()?;
        let conn = self.db.lock().unwrap();
        let id = payload
            .id
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| Uuid::now_v7().to_string());
        let jump_host_id = payload.jump_host_id.filter(|s| !s.trim().is_empty());
        let protocol = payload.protocol.trim().to_lowercase();
        if !PROTOCOLS.contains(&protocol.as_str()) {
            return Err(VaultError::ValidationError(format!(
                "Protocolo no soportado: {}",
                payload.protocol
            )));
        }
        let rdp_domain = payload
            .rdp_domain
            .map(|d| d.trim().to_string())
            .filter(|d| !d.is_empty());
        let port = if payload.port == 0 {
            default_port_for(&protocol)
        } else {
            payload.port
        };

        if let Some(ref jump_id) = jump_host_id {
            check_jump_host_cycles(&conn, &id, jump_id)?;
        }

        let now = Utc::now().to_rfc3339();
        let tags_json = serde_json::to_string(&payload.tags).unwrap_or_else(|_| "[]".to_string());

        let enc_notes = if let Some(notes) = payload.notes {
            Some(encrypt_record(&vault_key, notes.as_bytes())?)
        } else {
            conn.query_row(
                "SELECT encrypted_notes FROM hosts WHERE id = ?1",
                params![id],
                |row| row.get::<_, Option<Vec<u8>>>(0),
            )
            .unwrap_or(None)
        };

        conn.execute(
            "INSERT INTO hosts (id, folder_id, label, hostname, port, username_override, identity_id, tags_json, encrypted_notes, jump_host_id, updated_at, protocol, rdp_domain)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
             ON CONFLICT(id) DO UPDATE SET
                folder_id = excluded.folder_id,
                label = excluded.label,
                hostname = excluded.hostname,
                port = excluded.port,
                username_override = excluded.username_override,
                identity_id = excluded.identity_id,
                tags_json = excluded.tags_json,
                encrypted_notes = excluded.encrypted_notes,
                jump_host_id = excluded.jump_host_id,
                protocol = excluded.protocol,
                rdp_domain = excluded.rdp_domain,
                updated_at = excluded.updated_at",
            params![
                id,
                payload.folder_id,
                payload.label,
                payload.hostname,
                port as u32,
                payload.username_override,
                payload.identity_id,
                tags_json,
                enc_notes,
                jump_host_id,
                now,
                protocol,
                rdp_domain
            ],
        )?;

        Ok(id)
    }

    /// Devuelve la huella SHA-256 (hex) del certificado RDP aceptado para un host.
    pub fn get_rdp_cert_fingerprint(&self, host_id: &str) -> Result<Option<String>, VaultError> {
        let _ = self.get_active_vault_key()?;
        let conn = self.db.lock().unwrap();
        let fp = conn
            .query_row(
                "SELECT sha256_hex FROM rdp_cert_fingerprints WHERE host_id = ?1",
                params![host_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        Ok(fp)
    }

    /// Guarda (o reemplaza) la huella SHA-256 del certificado RDP aceptado por el usuario.
    pub fn accept_rdp_cert_fingerprint(
        &self,
        host_id: &str,
        sha256_hex: &str,
    ) -> Result<(), VaultError> {
        let _ = self.get_active_vault_key()?;
        let fp = sha256_hex.trim().to_lowercase();
        if fp.len() != 64 || !fp.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(VaultError::ValidationError(
                "Invalid SHA-256 fingerprint".into(),
            ));
        }
        let conn = self.db.lock().unwrap();
        conn.execute(
            "INSERT INTO rdp_cert_fingerprints (host_id, sha256_hex, accepted_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(host_id) DO UPDATE SET sha256_hex = excluded.sha256_hex, accepted_at = excluded.accepted_at",
            params![host_id, fp, Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    pub fn delete_host(&self, id: &str) -> Result<(), VaultError> {
        let _ = self.get_active_vault_key()?;
        let conn = self.db.lock().unwrap();
        conn.execute("DELETE FROM hosts WHERE id = ?1", params![id])?;
        Ok(())
    }
}

pub fn check_jump_host_cycles(
    conn: &rusqlite::Connection,
    target_host_id: &str,
    candidate_jump_id: &str,
) -> Result<(), VaultError> {
    if target_host_id == candidate_jump_id {
        return Err(VaultError::ValidationError(
            "Un host no puede ser su propio servidor de salto".into(),
        ));
    }

    let mut current = candidate_jump_id.to_string();
    let mut visited = HashSet::new();
    visited.insert(target_host_id.to_string());
    visited.insert(candidate_jump_id.to_string());

    loop {
        let next_jump: Option<String> = conn
            .query_row(
                "SELECT jump_host_id FROM hosts WHERE id = ?1",
                params![current],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()?
            .flatten();

        match next_jump {
            Some(jump) if !jump.trim().is_empty() => {
                if visited.contains(&jump) {
                    return Err(VaultError::ValidationError(
                        "Referencia circular detectada en la cadena de servidores de salto".into(),
                    ));
                }
                visited.insert(jump.clone());
                current = jump;
            }
            _ => break,
        }
    }

    Ok(())
}

// Tauri IPC Command wrappers
#[tauri::command]
pub fn get_inventory(manager: tauri::State<'_, std::sync::Arc<VaultManager>>) -> Result<InventoryData, VaultError> {
    manager.get_inventory()
}

#[tauri::command]
pub fn save_folder(manager: tauri::State<'_, std::sync::Arc<VaultManager>>, folder: Folder) -> Result<String, VaultError> {
    manager.save_folder(folder)
}

#[tauri::command]
pub fn delete_folder(manager: tauri::State<'_, std::sync::Arc<VaultManager>>, id: String) -> Result<(), VaultError> {
    manager.delete_folder(&id)
}

#[tauri::command]
pub fn save_identity(manager: tauri::State<'_, std::sync::Arc<VaultManager>>, payload: SaveIdentityPayload) -> Result<String, VaultError> {
    manager.save_identity(payload)
}

#[tauri::command]
pub fn delete_identity(manager: tauri::State<'_, std::sync::Arc<VaultManager>>, id: String) -> Result<(), VaultError> {
    manager.delete_identity(&id)
}

#[tauri::command]
pub fn save_host(manager: tauri::State<'_, std::sync::Arc<VaultManager>>, payload: SaveHostPayload) -> Result<String, VaultError> {
    manager.save_host(payload)
}

#[tauri::command]
pub fn delete_host(manager: tauri::State<'_, std::sync::Arc<VaultManager>>, id: String) -> Result<(), VaultError> {
    manager.delete_host(&id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_inventory_crud_and_zero_secrets_in_plaintext() {
        let conn = Connection::open_in_memory().unwrap();
        let manager = VaultManager::new(conn).unwrap();
        manager.init("VaultMasterPass!2026").unwrap();

        // 1. Create a folder
        let folder_id = manager
            .save_folder(Folder {
                id: "".to_string(),
                parent_id: None,
                name: "Production Servers".to_string(),
                icon: Some("server".to_string()),
                color: Some("#38bdf8".to_string()),
                sort_order: 1,
                updated_at: "".to_string(),
            })
            .unwrap();

        // 2. Create an identity with a highly sensitive password and passphrase
        let super_secret_password = "SUPER_SECRET_SSH_PASSWORD_98765";
        let super_secret_passphrase = "PASSPHRASE_ED25519_KEY_12345";
        let dummy_pub_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG... root@prod";
        let identity_id = manager
            .save_identity(SaveIdentityPayload {
                id: None,
                name: "Root Prod".to_string(),
                username: "root".to_string(),
                auth_type: "password".to_string(),
                public_key: Some(dummy_pub_key.to_string()),
                secret: Some(super_secret_password.to_string()),
                passphrase: Some(super_secret_passphrase.to_string()),
            })
            .unwrap();

        // 3. Create a host with encrypted notes
        let sensitive_note = "CONFIDENTIAL_SERVER_NOTE_DO_NOT_LEAK";
        let host_id = manager
            .save_host(SaveHostPayload {
                id: None,
                folder_id: Some(folder_id.clone()),
                jump_host_id: None,
                protocol: "ssh".to_string(),
                rdp_domain: None,
                label: "DB Primary".to_string(),
                hostname: "192.168.1.50".to_string(),
                port: 22,
                username_override: None,
                identity_id: Some(identity_id.clone()),
                tags: vec!["db".to_string(), "production".to_string()],
                notes: Some(sensitive_note.to_string()),
            })
            .unwrap();

        // 4. Verify that decrypted identity retrieves the secrets
        let dec_identity = manager.get_decrypted_identity(&identity_id).unwrap();
        assert_eq!(dec_identity.secret.as_deref(), Some(super_secret_password));
        assert_eq!(dec_identity.passphrase.as_deref(), Some(super_secret_passphrase));
        assert_eq!(dec_identity.public_key.as_deref(), Some(dummy_pub_key));

        // 5. Verify inventory retrieval
        let inv = manager.get_inventory().unwrap();
        assert_eq!(inv.folders.len(), 1);
        assert_eq!(inv.identities.len(), 1);
        assert!(inv.identities[0].has_secret);
        assert_eq!(inv.identities[0].public_key.as_deref(), Some(dummy_pub_key));
        assert_eq!(inv.hosts.len(), 1);
        assert_eq!(inv.hosts[0].notes.as_deref(), Some(sensitive_note));
        assert_eq!(inv.hosts[0].jump_host_id, None);

        // 6. CRITICAL SECURITY CHECK:
        // Direct query to the raw database to verify NO plain text secrets exist in SQLite columns!
        let conn = manager.db.lock().unwrap();
        let raw_secret: Vec<u8> = conn
            .query_row(
                "SELECT encrypted_secret FROM identities WHERE id = ?1",
                params![identity_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_ne!(raw_secret, super_secret_password.as_bytes());
        assert!(!raw_secret.windows(super_secret_password.len()).any(|w| w == super_secret_password.as_bytes()));

        let raw_notes: Vec<u8> = conn
            .query_row(
                "SELECT encrypted_notes FROM hosts WHERE id = ?1",
                params![host_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_ne!(raw_notes, sensitive_note.as_bytes());
        assert!(!raw_notes.windows(sensitive_note.len()).any(|w| w == sensitive_note.as_bytes()));
    }

    #[test]
    fn test_jump_host_chaining_and_cycle_prevention() {
        let conn = Connection::open_in_memory().unwrap();
        let manager = VaultManager::new(conn).unwrap();
        manager.init("VaultMasterPass!2026").unwrap();

        // 1. Create Bastion A
        let bastion_a_id = manager
            .save_host(SaveHostPayload {
                id: Some("host-bastion-a".to_string()),
                folder_id: None,
                jump_host_id: None,
                protocol: "ssh".to_string(),
                rdp_domain: None,
                label: "Bastion A".to_string(),
                hostname: "bastion-a.internal".to_string(),
                port: 22,
                username_override: None,
                identity_id: None,
                tags: vec![],
                notes: None,
            })
            .unwrap();

        // 2. Create Bastion B jumping through Bastion A
        let bastion_b_id = manager
            .save_host(SaveHostPayload {
                id: Some("host-bastion-b".to_string()),
                folder_id: None,
                jump_host_id: Some(bastion_a_id.clone()),
                protocol: "ssh".to_string(),
                rdp_domain: None,
                label: "Bastion B".to_string(),
                hostname: "bastion-b.internal".to_string(),
                port: 22,
                username_override: None,
                identity_id: None,
                tags: vec![],
                notes: None,
            })
            .unwrap();

        // 3. Create Target C jumping through Bastion B
        let target_c_id = manager
            .save_host(SaveHostPayload {
                id: Some("host-target-c".to_string()),
                folder_id: None,
                jump_host_id: Some(bastion_b_id.clone()),
                protocol: "ssh".to_string(),
                rdp_domain: None,
                label: "Target Server C".to_string(),
                hostname: "target-c.internal".to_string(),
                port: 2222,
                username_override: None,
                identity_id: None,
                tags: vec![],
                notes: None,
            })
            .unwrap();

        // 4. Verify chain persisted properly
        let inv = manager.get_inventory().unwrap();
        let host_a = inv.hosts.iter().find(|h| h.id == bastion_a_id).unwrap();
        let host_b = inv.hosts.iter().find(|h| h.id == bastion_b_id).unwrap();
        let host_c = inv.hosts.iter().find(|h| h.id == target_c_id).unwrap();
        assert_eq!(host_a.jump_host_id, None);
        assert_eq!(host_b.jump_host_id.as_deref(), Some(bastion_a_id.as_str()));
        assert_eq!(host_c.jump_host_id.as_deref(), Some(bastion_b_id.as_str()));

        // 5. TEST: Host cannot be its own jump host
        let self_cycle_err = manager.save_host(SaveHostPayload {
            id: Some(bastion_a_id.clone()),
            folder_id: None,
            jump_host_id: Some(bastion_a_id.clone()),
            protocol: "ssh".to_string(),
            rdp_domain: None,
            label: "Bastion A".to_string(),
            hostname: "bastion-a.internal".to_string(),
            port: 22,
            username_override: None,
            identity_id: None,
            tags: vec![],
            notes: None,
        });
        assert!(matches!(self_cycle_err, Err(VaultError::ValidationError(_))));

        // 6. TEST: Direct cycle A -> B -> A should fail
        let direct_cycle_err = manager.save_host(SaveHostPayload {
            id: Some(bastion_a_id.clone()),
            folder_id: None,
            jump_host_id: Some(bastion_b_id.clone()),
            protocol: "ssh".to_string(),
            rdp_domain: None,
            label: "Bastion A".to_string(),
            hostname: "bastion-a.internal".to_string(),
            port: 22,
            username_override: None,
            identity_id: None,
            tags: vec![],
            notes: None,
        });
        assert!(matches!(direct_cycle_err, Err(VaultError::ValidationError(_))));

        // 7. TEST: Indirect cycle A -> B -> C -> A should fail
        let indirect_cycle_err = manager.save_host(SaveHostPayload {
            id: Some(bastion_a_id.clone()),
            folder_id: None,
            jump_host_id: Some(target_c_id.clone()),
            protocol: "ssh".to_string(),
            rdp_domain: None,
            label: "Bastion A".to_string(),
            hostname: "bastion-a.internal".to_string(),
            port: 22,
            username_override: None,
            identity_id: None,
            tags: vec![],
            notes: None,
        });
        assert!(matches!(indirect_cycle_err, Err(VaultError::ValidationError(_))));
    }

    fn protocol_payload(protocol: &str, port: u16) -> SaveHostPayload {
        SaveHostPayload {
            id: None,
            folder_id: None,
            jump_host_id: None,
            protocol: protocol.to_string(),
            rdp_domain: None,
            label: format!("{} host", protocol),
            hostname: "10.0.0.5".to_string(),
            port,
            username_override: None,
            identity_id: None,
            tags: vec![],
            notes: None,
        }
    }

    fn unlocked_manager() -> VaultManager {
        let conn = Connection::open_in_memory().unwrap();
        let manager = VaultManager::new(conn).unwrap();
        manager.init("VaultMasterPass!2026").unwrap();
        manager
    }

    #[test]
    fn test_default_ports_per_protocol() {
        assert_eq!(default_port_for("ssh"), 22);
        assert_eq!(default_port_for("rdp"), 3389);
        assert_eq!(default_port_for("vnc"), 5900);
    }

    #[test]
    fn test_save_rdp_and_vnc_hosts_with_protocol_and_domain() {
        let manager = unlocked_manager();
        let mut rdp = protocol_payload("RDP", 3389);
        rdp.rdp_domain = Some("  CORP  ".to_string());
        manager.save_host(rdp).unwrap();
        manager.save_host(protocol_payload("vnc", 5901)).unwrap();

        let inv = manager.get_inventory().unwrap();
        let rdp = inv.hosts.iter().find(|h| h.protocol == "rdp").unwrap();
        assert_eq!(rdp.rdp_domain.as_deref(), Some("CORP"));
        assert_eq!(rdp.port, 3389);
        let vnc = inv.hosts.iter().find(|h| h.protocol == "vnc").unwrap();
        assert_eq!(vnc.port, 5901);
    }

    #[test]
    fn test_port_zero_uses_protocol_default() {
        let manager = unlocked_manager();
        manager.save_host(protocol_payload("rdp", 0)).unwrap();
        let inv = manager.get_inventory().unwrap();
        assert_eq!(inv.hosts[0].port, 3389);
    }

    #[test]
    fn test_invalid_protocol_is_rejected() {
        let manager = unlocked_manager();
        let err = manager.save_host(protocol_payload("telnet", 23));
        assert!(matches!(err, Err(VaultError::ValidationError(_))));
        assert!(manager.get_inventory().unwrap().hosts.is_empty());
    }

    #[test]
    fn test_legacy_host_defaults_to_ssh_after_migration() {
        let conn = Connection::open_in_memory().unwrap();
        // Esquema antiguo sin columnas de protocolo
        conn.execute_batch(
            "CREATE TABLE hosts (
                id TEXT PRIMARY KEY, folder_id TEXT, jump_host_id TEXT, label TEXT NOT NULL,
                hostname TEXT NOT NULL, port INTEGER NOT NULL DEFAULT 22, username_override TEXT,
                identity_id TEXT, tags_json TEXT NOT NULL DEFAULT '[]', encrypted_notes BLOB,
                updated_at TEXT NOT NULL);
             INSERT INTO hosts (id, label, hostname, port, updated_at) VALUES ('h1','old','1.1.1.1',22,'now');",
        )
        .unwrap();
        VaultManager::run_migrations(&conn).unwrap();
        let proto: String = conn
            .query_row("SELECT protocol FROM hosts WHERE id='h1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(proto, "ssh");
    }

    #[test]
    fn test_rdp_cert_fingerprint_tofu_roundtrip() {
        let manager = unlocked_manager();
        let id = manager.save_host(protocol_payload("rdp", 3389)).unwrap();
        assert_eq!(manager.get_rdp_cert_fingerprint(&id).unwrap(), None);

        let fp1 = "AB".repeat(32);
        manager.accept_rdp_cert_fingerprint(&id, &fp1).unwrap();
        assert_eq!(
            manager.get_rdp_cert_fingerprint(&id).unwrap(),
            Some(fp1.to_lowercase())
        );

        let fp2 = "cd".repeat(32);
        manager.accept_rdp_cert_fingerprint(&id, &fp2).unwrap();
        assert_eq!(manager.get_rdp_cert_fingerprint(&id).unwrap(), Some(fp2));

        assert!(matches!(
            manager.accept_rdp_cert_fingerprint(&id, "zz"),
            Err(VaultError::ValidationError(_))
        ));
    }

    #[test]
    fn test_rdp_fingerprint_removed_with_host() {
        let manager = unlocked_manager();
        let id = manager.save_host(protocol_payload("rdp", 3389)).unwrap();
        manager.accept_rdp_cert_fingerprint(&id, &"ab".repeat(32)).unwrap();
        manager.delete_host(&id).unwrap();
        assert_eq!(manager.get_rdp_cert_fingerprint(&id).unwrap(), None);
    }
}
