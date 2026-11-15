use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::vault::db::{VaultError, VaultManager};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct CommandSnippet {
    pub id: String,
    pub title: String,
    pub command_template: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SaveSnippetPayload {
    pub id: Option<String>,
    pub title: String,
    pub command_template: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
}

pub fn get_snippets_internal(conn: &Connection) -> Result<Vec<CommandSnippet>, VaultError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, command_template, description, tags_json, created_at, updated_at
         FROM snippets ORDER BY title ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        let tags_json: String = row.get(4)?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        Ok(CommandSnippet {
            id: row.get(0)?,
            title: row.get(1)?,
            command_template: row.get(2)?,
            description: row.get(3)?,
            tags,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;

    let mut snippets = Vec::new();
    for snippet in rows {
        snippets.push(snippet?);
    }
    Ok(snippets)
}

pub fn save_snippet_internal(
    conn: &Connection,
    payload: &SaveSnippetPayload,
) -> Result<String, VaultError> {
    let now = Utc::now().to_rfc3339();
    let tags_json = serde_json::to_string(&payload.tags).unwrap_or_else(|_| "[]".to_string());

    let id = match &payload.id {
        Some(existing_id) => {
            conn.execute(
                "UPDATE snippets
                 SET title = ?1, command_template = ?2, description = ?3, tags_json = ?4, updated_at = ?5
                 WHERE id = ?6",
                params![
                    payload.title,
                    payload.command_template,
                    payload.description,
                    tags_json,
                    now,
                    existing_id
                ],
            )?;
            existing_id.clone()
        }
        None => {
            let new_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO snippets (id, title, command_template, description, tags_json, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    new_id,
                    payload.title,
                    payload.command_template,
                    payload.description,
                    tags_json,
                    now,
                    now
                ],
            )?;
            new_id
        }
    };

    Ok(id)
}

pub fn delete_snippet_internal(conn: &Connection, id: &str) -> Result<(), VaultError> {
    conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn get_snippets(
    vault_mgr: State<'_, Arc<VaultManager>>,
) -> Result<Vec<CommandSnippet>, VaultError> {
    let conn = vault_mgr.db.lock().unwrap();
    get_snippets_internal(&conn)
}

#[tauri::command]
pub fn save_snippet(
    payload: SaveSnippetPayload,
    vault_mgr: State<'_, Arc<VaultManager>>,
) -> Result<String, VaultError> {
    let conn = vault_mgr.db.lock().unwrap();
    save_snippet_internal(&conn, &payload)
}

#[tauri::command]
pub fn delete_snippet(
    id: String,
    vault_mgr: State<'_, Arc<VaultManager>>,
) -> Result<(), VaultError> {
    let conn = vault_mgr.db.lock().unwrap();
    delete_snippet_internal(&conn, &id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_snippet_crud() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();

        // 1. Initial list empty
        let initial = get_snippets_internal(&conn).unwrap();
        assert_eq!(initial.len(), 0);

        // 2. Create snippet with parameters
        let payload = SaveSnippetPayload {
            id: None,
            title: "Docker Logs".to_string(),
            command_template: "docker logs -f --tail {{lines}} {{container}}".to_string(),
            description: Some("Follow logs of a container".to_string()),
            tags: vec!["docker".to_string(), "logs".to_string()],
        };

        let id = save_snippet_internal(&conn, &payload).unwrap();
        assert!(!id.is_empty());

        let list = get_snippets_internal(&conn).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "Docker Logs");
        assert_eq!(list[0].tags, vec!["docker", "logs"]);

        // 3. Update snippet
        let mut update_payload = payload.clone();
        update_payload.id = Some(id.clone());
        update_payload.title = "Docker Logs Advanced".to_string();

        let updated_id = save_snippet_internal(&conn, &update_payload).unwrap();
        assert_eq!(updated_id, id);

        let list_after_update = get_snippets_internal(&conn).unwrap();
        assert_eq!(list_after_update[0].title, "Docker Logs Advanced");

        // 4. Delete snippet
        delete_snippet_internal(&conn, &id).unwrap();
        let list_after_delete = get_snippets_internal(&conn).unwrap();
        assert_eq!(list_after_delete.len(), 0);
    }
}
