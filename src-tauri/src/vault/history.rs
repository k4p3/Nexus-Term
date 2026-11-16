//! Historial de comandos por host (cifrado con la `VaultKey`) y layout de sesiones.

use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use super::crypto::{decrypt_record, encrypt_record};
use super::db::{VaultError, VaultManager};

/// Longitud máxima (bytes) de un comando registrado.
pub const MAX_COMMAND_BYTES: usize = 4096;
/// Máximo de entradas devueltas por búsqueda.
pub const MAX_SEARCH_LIMIT: u32 = 2000;
/// Tamaño máximo del JSON del layout.
pub const MAX_LAYOUT_BYTES: usize = 256 * 1024;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct HistoryEntry {
    pub id: String,
    pub host_id: String,
    pub command: String,
    pub use_count: u32,
    pub last_exit_code: Option<i32>,
    pub last_used_at: String,
}

fn dedupe_key(host_id: &str, command: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(host_id.as_bytes());
    hasher.update([0u8]);
    hasher.update(command.as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

impl VaultManager {
    pub fn history_record(
        &self,
        host_id: &str,
        command: &str,
        exit_code: Option<i32>,
    ) -> Result<(), VaultError> {
        let vault_key = self.get_active_vault_key()?;
        let command = command.trim_end_matches(['\r', '\n']);
        if host_id.is_empty() {
            return Err(VaultError::ValidationError("host_id is required".into()));
        }
        if command.trim().is_empty() {
            return Err(VaultError::ValidationError("Command is empty".into()));
        }
        if command.len() > MAX_COMMAND_BYTES {
            return Err(VaultError::ValidationError("Command is too long".into()));
        }
        let key = dedupe_key(host_id, command);
        let encrypted = encrypt_record(&vault_key, command.as_bytes())?;
        let now = Utc::now().to_rfc3339();
        let conn = self.db.lock().unwrap();
        conn.execute(
            "INSERT INTO command_history
                (id, host_id, dedupe_key, encrypted_command, use_count, last_exit_code, last_used_at)
             VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)
             ON CONFLICT(host_id, dedupe_key) DO UPDATE SET
                use_count = use_count + 1,
                last_exit_code = excluded.last_exit_code,
                last_used_at = excluded.last_used_at,
                encrypted_command = excluded.encrypted_command",
            params![Uuid::now_v7().to_string(), host_id, key, encrypted, exit_code, now],
        )?;
        Ok(())
    }

    pub fn history_search(
        &self,
        host_id: &str,
        query: Option<&str>,
        limit: u32,
    ) -> Result<Vec<HistoryEntry>, VaultError> {
        let vault_key = self.get_active_vault_key()?;
        let limit = limit.clamp(1, MAX_SEARCH_LIMIT);
        let needle = query.map(|q| q.trim().to_lowercase()).filter(|q| !q.is_empty());
        let conn = self.db.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, encrypted_command, use_count, last_exit_code, last_used_at
             FROM command_history WHERE host_id = ?1
             ORDER BY last_used_at DESC",
        )?;
        let rows = stmt.query_map(params![host_id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, Vec<u8>>(1)?,
                r.get::<_, u32>(2)?,
                r.get::<_, Option<i32>>(3)?,
                r.get::<_, String>(4)?,
            ))
        })?;
        let mut out = Vec::new();
        for row in rows {
            let (id, blob, use_count, last_exit_code, last_used_at) = row?;
            let command = String::from_utf8_lossy(&decrypt_record(&vault_key, &blob)?).into_owned();
            if needle
                .as_ref()
                .is_some_and(|n| !command.to_lowercase().contains(n.as_str()))
            {
                continue;
            }
            out.push(HistoryEntry {
                id,
                host_id: host_id.to_string(),
                command,
                use_count,
                last_exit_code,
                last_used_at,
            });
            if out.len() >= limit as usize {
                break;
            }
        }
        Ok(out)
    }

    pub fn history_delete(&self, id: &str) -> Result<(), VaultError> {
        let _ = self.get_active_vault_key()?;
        let conn = self.db.lock().unwrap();
        conn.execute("DELETE FROM command_history WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Borra el historial de un host, o todo si `host_id` es `None`. Devuelve las filas eliminadas.
    pub fn history_clear(&self, host_id: Option<&str>) -> Result<u64, VaultError> {
        let _ = self.get_active_vault_key()?;
        let conn = self.db.lock().unwrap();
        let n = match host_id {
            Some(h) => conn.execute("DELETE FROM command_history WHERE host_id = ?1", params![h])?,
            None => conn.execute("DELETE FROM command_history", [])?,
        };
        Ok(n as u64)
    }

    pub fn session_layout_save(&self, layout_json: &str) -> Result<(), VaultError> {
        if layout_json.len() > MAX_LAYOUT_BYTES {
            return Err(VaultError::ValidationError("Layout is too large".into()));
        }
        serde_json::from_str::<serde_json::Value>(layout_json)
            .map_err(|e| VaultError::ValidationError(format!("Invalid layout JSON: {e}")))?;
        let now = Utc::now().to_rfc3339();
        let conn = self.db.lock().unwrap();
        conn.execute(
            "INSERT INTO session_layout (id, layout_json, updated_at) VALUES (1, ?1, ?2)
             ON CONFLICT(id) DO UPDATE SET layout_json = excluded.layout_json, updated_at = excluded.updated_at",
            params![layout_json, now],
        )?;
        Ok(())
    }

    pub fn session_layout_get(&self) -> Result<Option<String>, VaultError> {
        use rusqlite::OptionalExtension;
        let conn = self.db.lock().unwrap();
        Ok(conn
            .query_row("SELECT layout_json FROM session_layout WHERE id = 1", [], |r| r.get(0))
            .optional()?)
    }

    pub fn session_layout_clear(&self) -> Result<(), VaultError> {
        let conn = self.db.lock().unwrap();
        conn.execute("DELETE FROM session_layout", [])?;
        Ok(())
    }
}

#[tauri::command]
pub fn history_record(
    manager: State<'_, Arc<VaultManager>>,
    host_id: String,
    command: String,
    exit_code: Option<i32>,
) -> Result<(), VaultError> {
    manager.history_record(&host_id, &command, exit_code)
}

#[tauri::command]
pub fn history_search(
    manager: State<'_, Arc<VaultManager>>,
    host_id: String,
    query: Option<String>,
    limit: u32,
) -> Result<Vec<HistoryEntry>, VaultError> {
    manager.history_search(&host_id, query.as_deref(), limit)
}

#[tauri::command]
pub fn history_delete(manager: State<'_, Arc<VaultManager>>, id: String) -> Result<(), VaultError> {
    manager.history_delete(&id)
}

#[tauri::command]
pub fn history_clear(
    manager: State<'_, Arc<VaultManager>>,
    host_id: Option<String>,
) -> Result<u64, VaultError> {
    manager.history_clear(host_id.as_deref())
}

#[tauri::command]
pub fn session_layout_save(
    manager: State<'_, Arc<VaultManager>>,
    layout_json: String,
) -> Result<(), VaultError> {
    manager.session_layout_save(&layout_json)
}

#[tauri::command]
pub fn session_layout_get(manager: State<'_, Arc<VaultManager>>) -> Result<Option<String>, VaultError> {
    manager.session_layout_get()
}

#[tauri::command]
pub fn session_layout_clear(manager: State<'_, Arc<VaultManager>>) -> Result<(), VaultError> {
    manager.session_layout_clear()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::inventory::SaveHostPayload;
    use rusqlite::Connection;

    fn unlocked_manager() -> VaultManager {
        let conn = Connection::open_in_memory().unwrap();
        let manager = VaultManager::new(conn).unwrap();
        manager.init("VaultMasterPass!2026").unwrap();
        manager
    }

    fn make_host(m: &VaultManager, label: &str) -> String {
        m.save_host(SaveHostPayload {
            id: None,
            folder_id: None,
            jump_host_id: None,
            protocol: "ssh".into(),
            rdp_domain: None,
            label: label.into(),
            hostname: "example.com".into(),
            port: 22,
            username_override: None,
            identity_id: None,
            tags: vec![],
            notes: None,
        })
        .unwrap()
    }

    #[test]
    fn test_history_never_stores_plaintext() {
        let m = unlocked_manager();
        let h = make_host(&m, "a");
        m.history_record(&h, "systemctl restart nginx-unique-marker", Some(0)).unwrap();
        let conn = m.db.lock().unwrap();
        let blob: Vec<u8> = conn
            .query_row("SELECT encrypted_command FROM command_history", [], |r| r.get(0))
            .unwrap();
        let marker = b"nginx-unique-marker";
        assert!(!blob.windows(marker.len()).any(|w| w == marker));
        let key: String = conn
            .query_row("SELECT dedupe_key FROM command_history", [], |r| r.get(0))
            .unwrap();
        assert!(!key.contains("nginx"));
        assert_eq!(key.len(), 64);
    }

    #[test]
    fn test_history_roundtrip_and_deduplication() {
        let m = unlocked_manager();
        let h = make_host(&m, "a");
        m.history_record(&h, "ls -la", Some(0)).unwrap();
        m.history_record(&h, "ls -la\n", Some(1)).unwrap();
        m.history_record(&h, "pwd", None).unwrap();
        let all = m.history_search(&h, None, 100).unwrap();
        assert_eq!(all.len(), 2);
        let ls = all.iter().find(|e| e.command == "ls -la").unwrap();
        assert_eq!(ls.use_count, 2);
        assert_eq!(ls.last_exit_code, Some(1));
        let found = m.history_search(&h, Some("PW"), 100).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].command, "pwd");
        assert_eq!(m.history_search(&h, None, 1).unwrap().len(), 1);
    }

    #[test]
    fn test_history_is_scoped_per_host() {
        let m = unlocked_manager();
        let a = make_host(&m, "a");
        let b = make_host(&m, "b");
        m.history_record(&a, "echo a", None).unwrap();
        m.history_record(&b, "echo a", None).unwrap();
        assert_eq!(m.history_search(&a, None, 10).unwrap().len(), 1);
        assert_eq!(m.history_clear(Some(&a)).unwrap(), 1);
        assert_eq!(m.history_search(&b, None, 10).unwrap().len(), 1);
        assert_eq!(m.history_clear(None).unwrap(), 1);
    }

    #[test]
    fn test_history_local_key_and_delete_entry() {
        let m = unlocked_manager();
        m.history_record("local", "htop", None).unwrap();
        let e = m.history_search("local", None, 10).unwrap();
        assert_eq!(e.len(), 1);
        m.history_delete(&e[0].id).unwrap();
        assert!(m.history_search("local", None, 10).unwrap().is_empty());
    }

    #[test]
    fn test_history_cascade_on_host_delete() {
        let m = unlocked_manager();
        let h = make_host(&m, "a");
        m.history_record(&h, "uptime", None).unwrap();
        m.history_record("local", "uptime", None).unwrap();
        m.delete_host(&h).unwrap();
        assert!(m.history_search(&h, None, 10).unwrap().is_empty());
        assert_eq!(m.history_search("local", None, 10).unwrap().len(), 1);
    }

    #[test]
    fn test_history_requires_unlocked_vault() {
        let m = unlocked_manager();
        m.history_record("local", "ls", None).unwrap();
        m.lock();
        assert!(matches!(m.history_record("local", "ls", None), Err(VaultError::Locked)));
        assert!(matches!(m.history_search("local", None, 10), Err(VaultError::Locked)));
        assert!(matches!(m.history_delete("x"), Err(VaultError::Locked)));
        assert!(matches!(m.history_clear(None), Err(VaultError::Locked)));
    }

    #[test]
    fn test_history_rejects_empty_and_oversized() {
        let m = unlocked_manager();
        assert!(m.history_record("local", "   \n", None).is_err());
        assert!(m.history_record("", "ls", None).is_err());
        assert!(m.history_record("local", &"x".repeat(MAX_COMMAND_BYTES + 1), None).is_err());
        assert!(m.history_record("local", &"x".repeat(MAX_COMMAND_BYTES), None).is_ok());
    }

    #[test]
    fn test_session_layout_roundtrip_and_validation() {
        let m = unlocked_manager();
        assert_eq!(m.session_layout_get().unwrap(), None);
        m.session_layout_save("{\"tabs\":[]}").unwrap();
        m.session_layout_save("{\"tabs\":[1]}").unwrap();
        assert_eq!(m.session_layout_get().unwrap().as_deref(), Some("{\"tabs\":[1]}"));
        assert!(m.session_layout_save("not json").is_err());
        let big = format!("\"{}\"", "a".repeat(MAX_LAYOUT_BYTES));
        assert!(m.session_layout_save(&big).is_err());
        m.session_layout_clear().unwrap();
        assert_eq!(m.session_layout_get().unwrap(), None);
    }

    #[test]
    fn test_migration_is_idempotent_on_existing_db() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();
        VaultManager::run_migrations(&conn).unwrap();
    }
}
