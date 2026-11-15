use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, RwLock};
use thiserror::Error;

use super::crypto::{
    derive_master_key, generate_salt, unwrap_vault_key, wrap_vault_key, CryptoError, VaultKey,
    DEFAULT_KDF_ITERATIONS, DEFAULT_KDF_MEM_KIB, DEFAULT_KDF_PARALLELISM,
};

#[derive(Error, Debug)]
pub enum VaultError {
    #[error("Database error: {0}")]
    DbError(#[from] rusqlite::Error),
    #[error("Crypto error: {0}")]
    Crypto(#[from] CryptoError),
    #[error("Vault is already initialized")]
    AlreadyInitialized,
    #[error("Vault is not initialized yet")]
    NotInitialized,
    #[error("Vault is currently locked. Unlock with master password first.")]
    Locked,
    #[error("Current master password is incorrect")]
    InvalidCurrentPassword,
}

impl serde::Serialize for VaultError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VaultStatus {
    pub is_initialized: bool,
    pub is_unlocked: bool,
}

pub struct VaultManager {
    pub db: Mutex<Connection>,
    pub active_key: RwLock<Option<VaultKey>>,
}

impl VaultManager {
    pub fn new(conn: Connection) -> Result<Self, VaultError> {
        Self::run_migrations(&conn)?;
        Ok(Self {
            db: Mutex::new(conn),
            active_key: RwLock::new(None),
        })
    }

    pub fn run_migrations(conn: &Connection) -> Result<(), VaultError> {
        conn.execute_batch(
            "
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS vault_meta (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                kdf_salt BLOB NOT NULL,
                kdf_mem_kib INTEGER NOT NULL,
                kdf_iterations INTEGER NOT NULL,
                kdf_parallelism INTEGER NOT NULL,
                wrapped_vault_key BLOB NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                icon TEXT,
                color TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS identities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                username TEXT NOT NULL,
                auth_type TEXT NOT NULL CHECK (auth_type IN ('password', 'private_key', 'agent')),
                encrypted_secret BLOB,
                encrypted_passphrase BLOB,
                public_key TEXT,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS hosts (
                id TEXT PRIMARY KEY,
                folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
                label TEXT NOT NULL,
                hostname TEXT NOT NULL,
                port INTEGER NOT NULL DEFAULT 22,
                username_override TEXT,
                identity_id TEXT REFERENCES identities(id) ON DELETE SET NULL,
                tags_json TEXT NOT NULL DEFAULT '[]',
                encrypted_notes BLOB,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS known_hosts (
                id TEXT PRIMARY KEY,
                hostname TEXT NOT NULL,
                port INTEGER NOT NULL,
                key_type TEXT NOT NULL,
                fingerprint_sha256 TEXT NOT NULL,
                public_key_base64 TEXT NOT NULL,
                trusted_at TEXT NOT NULL,
                UNIQUE(hostname, port)
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                settings_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS snippets (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                command_template TEXT NOT NULL,
                description TEXT,
                tags_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            ",
        )?;
        let _ = conn.execute("ALTER TABLE identities ADD COLUMN public_key TEXT", []);
        Ok(())
    }

    pub fn status(&self) -> Result<VaultStatus, VaultError> {
        let conn = self.db.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM vault_meta WHERE id = 1",
            [],
            |row| row.get(0),
        )?;
        let is_initialized = count > 0;
        let is_unlocked = self.active_key.read().unwrap().is_some();
        Ok(VaultStatus {
            is_initialized,
            is_unlocked,
        })
    }

    pub fn init(&self, master_password: &str) -> Result<(), VaultError> {
        let conn = self.db.lock().unwrap();
        let exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM vault_meta WHERE id = 1",
            [],
            |row| row.get(0),
        )?;
        if exists > 0 {
            return Err(VaultError::AlreadyInitialized);
        }

        let salt = generate_salt();
        let master_key = derive_master_key(
            master_password,
            &salt,
            DEFAULT_KDF_MEM_KIB,
            DEFAULT_KDF_ITERATIONS,
            DEFAULT_KDF_PARALLELISM,
        )?;

        let vault_key = VaultKey::generate_random();
        let wrapped_key = wrap_vault_key(&vault_key, &master_key)?;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO vault_meta (id, kdf_salt, kdf_mem_kib, kdf_iterations, kdf_parallelism, wrapped_vault_key, created_at, updated_at)
             VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                salt.to_vec(),
                DEFAULT_KDF_MEM_KIB,
                DEFAULT_KDF_ITERATIONS,
                DEFAULT_KDF_PARALLELISM,
                wrapped_key,
                now,
                now
            ],
        )?;

        *self.active_key.write().unwrap() = Some(vault_key);
        Ok(())
    }

    pub fn unlock(&self, master_password: &str) -> Result<(), VaultError> {
        let conn = self.db.lock().unwrap();
        let meta = conn.query_row(
            "SELECT kdf_salt, kdf_mem_kib, kdf_iterations, kdf_parallelism, wrapped_vault_key FROM vault_meta WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, Vec<u8>>(0)?,
                    row.get::<_, u32>(1)?,
                    row.get::<_, u32>(2)?,
                    row.get::<_, u32>(3)?,
                    row.get::<_, Vec<u8>>(4)?,
                ))
            },
        ).optional()?;

        let (salt, mem_kib, iterations, parallelism, wrapped_key) = match meta {
            Some(data) => data,
            None => return Err(VaultError::NotInitialized),
        };

        let master_key = derive_master_key(
            master_password,
            &salt,
            mem_kib,
            iterations,
            parallelism,
        )?;

        let vault_key = unwrap_vault_key(&wrapped_key, &master_key)?;
        *self.active_key.write().unwrap() = Some(vault_key);
        Ok(())
    }

    pub fn lock(&self) {
        *self.active_key.write().unwrap() = None;
    }

    pub fn change_password(&self, current_password: &str, new_password: &str) -> Result<(), VaultError> {
        let conn = self.db.lock().unwrap();
        let meta = conn.query_row(
            "SELECT kdf_salt, kdf_mem_kib, kdf_iterations, kdf_parallelism, wrapped_vault_key FROM vault_meta WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, Vec<u8>>(0)?,
                    row.get::<_, u32>(1)?,
                    row.get::<_, u32>(2)?,
                    row.get::<_, u32>(3)?,
                    row.get::<_, Vec<u8>>(4)?,
                ))
            },
        ).optional()?;

        let (old_salt, old_mem, old_iter, old_par, wrapped_key) = match meta {
            Some(data) => data,
            None => return Err(VaultError::NotInitialized),
        };

        // Validate current password
        let old_master_key = derive_master_key(
            current_password,
            &old_salt,
            old_mem,
            old_iter,
            old_par,
        )?;

        let vault_key = unwrap_vault_key(&wrapped_key, &old_master_key)
            .map_err(|_| VaultError::InvalidCurrentPassword)?;

        // Derive with new password and new random salt
        let new_salt = generate_salt();
        let new_master_key = derive_master_key(
            new_password,
            &new_salt,
            DEFAULT_KDF_MEM_KIB,
            DEFAULT_KDF_ITERATIONS,
            DEFAULT_KDF_PARALLELISM,
        )?;

        let new_wrapped_key = wrap_vault_key(&vault_key, &new_master_key)?;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE vault_meta SET kdf_salt = ?1, kdf_mem_kib = ?2, kdf_iterations = ?3, kdf_parallelism = ?4, wrapped_vault_key = ?5, updated_at = ?6 WHERE id = 1",
            params![
                new_salt.to_vec(),
                DEFAULT_KDF_MEM_KIB,
                DEFAULT_KDF_ITERATIONS,
                DEFAULT_KDF_PARALLELISM,
                new_wrapped_key,
                now
            ],
        )?;

        *self.active_key.write().unwrap() = Some(vault_key);
        Ok(())
    }

    pub fn get_active_vault_key(&self) -> Result<VaultKey, VaultError> {
        let guard = self.active_key.read().unwrap();
        match &*guard {
            Some(key) => Ok(key.clone()),
            None => Err(VaultError::Locked),
        }
    }
}

// Tauri IPC Command wrappers
#[tauri::command]
pub fn vault_status(manager: tauri::State<'_, std::sync::Arc<VaultManager>>) -> Result<VaultStatus, VaultError> {
    manager.status()
}

#[tauri::command]
pub fn vault_init(manager: tauri::State<'_, std::sync::Arc<VaultManager>>, master_password: String) -> Result<(), VaultError> {
    manager.init(&master_password)
}

#[tauri::command]
pub fn vault_unlock(manager: tauri::State<'_, std::sync::Arc<VaultManager>>, master_password: String) -> Result<(), VaultError> {
    manager.unlock(&master_password)
}

#[tauri::command]
pub fn vault_lock(manager: tauri::State<'_, std::sync::Arc<VaultManager>>) -> Result<(), VaultError> {
    manager.lock();
    Ok(())
}

#[tauri::command]
pub fn vault_change_password(
    manager: tauri::State<'_, std::sync::Arc<VaultManager>>,
    current_password: String,
    new_password: String,
) -> Result<(), VaultError> {
    manager.change_password(&current_password, &new_password)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vault_lifecycle_in_memory() {
        let conn = Connection::open_in_memory().unwrap();
        let manager = VaultManager::new(conn).unwrap();

        // 1. Initial status: not initialized, not unlocked
        let st = manager.status().unwrap();
        assert!(!st.is_initialized);
        assert!(!st.is_unlocked);

        // 2. Initialize
        let pwd = "MasterPassword2026!";
        manager.init(pwd).unwrap();

        let st = manager.status().unwrap();
        assert!(st.is_initialized);
        assert!(st.is_unlocked);

        // Cannot init twice
        assert!(matches!(manager.init(pwd), Err(VaultError::AlreadyInitialized)));

        // 3. Lock
        manager.lock();
        let st = manager.status().unwrap();
        assert!(st.is_initialized);
        assert!(!st.is_unlocked);
        assert!(manager.get_active_vault_key().is_err());

        // 4. Unlock with wrong password fails
        assert!(manager.unlock("WrongPassword").is_err());
        assert!(!manager.status().unwrap().is_unlocked);

        // 5. Unlock with right password succeeds
        manager.unlock(pwd).unwrap();
        assert!(manager.status().unwrap().is_unlocked);
        assert!(manager.get_active_vault_key().is_ok());

        // 6. Change master password
        let new_pwd = "UpdatedMasterPassword999!";
        manager.change_password(pwd, new_pwd).unwrap();

        // Lock again
        manager.lock();
        // Old password fails
        assert!(manager.unlock(pwd).is_err());
        // New password works
        manager.unlock(new_pwd).unwrap();
        assert!(manager.status().unwrap().is_unlocked);
    }
}
