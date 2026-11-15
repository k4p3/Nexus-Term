use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
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
    pub secret: Option<String>,
    pub passphrase: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SaveIdentityPayload {
    pub id: Option<String>,
    pub name: String,
    pub username: String,
    pub auth_type: String,
    pub secret: Option<String>,
    pub passphrase: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HostSummary {
    pub id: String,
    pub folder_id: Option<String>,
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
        let mut stmt = conn.prepare("SELECT id, name, username, auth_type, encrypted_secret, encrypted_passphrase, updated_at FROM identities ORDER BY name ASC")?;
        let identities = stmt
            .query_map([], |row| {
                let enc_sec: Option<Vec<u8>> = row.get(4)?;
                let enc_pass: Option<Vec<u8>> = row.get(5)?;
                Ok(IdentitySummary {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    username: row.get(2)?,
                    auth_type: row.get(3)?,
                    has_secret: enc_sec.is_some(),
                    has_passphrase: enc_pass.is_some(),
                    updated_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        // 3. Hosts
        let mut stmt = conn.prepare("SELECT id, folder_id, label, hostname, port, username_override, identity_id, tags_json, encrypted_notes, updated_at FROM hosts ORDER BY label ASC")?;
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
                    label: row.get(2)?,
                    hostname: row.get(3)?,
                    port: row.get::<_, u32>(4)? as u16,
                    username_override: row.get(5)?,
                    identity_id: row.get(6)?,
                    tags,
                    notes,
                    updated_at: row.get(9)?,
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

        let enc_secret = if let Some(secret) = payload.secret {
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

        let enc_passphrase = if let Some(passphrase) = payload.passphrase {
            Some(encrypt_record(&vault_key, passphrase.as_bytes())?)
        } else {
            conn.query_row(
                "SELECT encrypted_passphrase FROM identities WHERE id = ?1",
                params![id],
                |row| row.get::<_, Option<Vec<u8>>>(0),
            )
            .unwrap_or(None)
        };

        conn.execute(
            "INSERT INTO identities (id, name, username, auth_type, encrypted_secret, encrypted_passphrase, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                username = excluded.username,
                auth_type = excluded.auth_type,
                encrypted_secret = excluded.encrypted_secret,
                encrypted_passphrase = excluded.encrypted_passphrase,
                updated_at = excluded.updated_at",
            params![
                id,
                payload.name,
                payload.username,
                payload.auth_type,
                enc_secret,
                enc_passphrase,
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

        let (name, username, auth_type, enc_sec, enc_pass) = conn.query_row(
            "SELECT name, username, auth_type, encrypted_secret, encrypted_passphrase FROM identities WHERE id = ?1",
            params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<Vec<u8>>>(3)?,
                    row.get::<_, Option<Vec<u8>>>(4)?,
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
            "INSERT INTO hosts (id, folder_id, label, hostname, port, username_override, identity_id, tags_json, encrypted_notes, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
                folder_id = excluded.folder_id,
                label = excluded.label,
                hostname = excluded.hostname,
                port = excluded.port,
                username_override = excluded.username_override,
                identity_id = excluded.identity_id,
                tags_json = excluded.tags_json,
                encrypted_notes = excluded.encrypted_notes,
                updated_at = excluded.updated_at",
            params![
                id,
                payload.folder_id,
                payload.label,
                payload.hostname,
                payload.port as u32,
                payload.username_override,
                payload.identity_id,
                tags_json,
                enc_notes,
                now
            ],
        )?;

        Ok(id)
    }

    pub fn delete_host(&self, id: &str) -> Result<(), VaultError> {
        let _ = self.get_active_vault_key()?;
        let conn = self.db.lock().unwrap();
        conn.execute("DELETE FROM hosts WHERE id = ?1", params![id])?;
        Ok(())
    }
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
        let identity_id = manager
            .save_identity(SaveIdentityPayload {
                id: None,
                name: "Root Prod".to_string(),
                username: "root".to_string(),
                auth_type: "password".to_string(),
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

        // 5. Verify inventory retrieval
        let inv = manager.get_inventory().unwrap();
        assert_eq!(inv.folders.len(), 1);
        assert_eq!(inv.identities.len(), 1);
        assert!(inv.identities[0].has_secret);
        assert_eq!(inv.hosts.len(), 1);
        assert_eq!(inv.hosts[0].notes.as_deref(), Some(sensitive_note));

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
}
