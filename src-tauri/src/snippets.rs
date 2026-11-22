use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
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
    pub is_builtin: bool,
    pub is_enabled: bool,
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
    pub is_enabled: Option<bool>,
}

pub fn seed_community_snippets(conn: &Connection) -> Result<(), VaultError> {
    let now = Utc::now().to_rfc3339();

    let builtins = [
        (
            "builtin-docker-logs",
            "Docker: Follow Logs",
            "docker logs -f --tail {{lines=100}} {{container}}",
            Some("Shows and follows the container's recent logs in real time."),
            "[\"docker\", \"logs\"]",
        ),
        (
            "builtin-docker-exec",
            "Docker: Interactive Shell",
            "docker exec -it {{container}} /bin/sh",
            Some("Opens an interactive shell inside the running container."),
            "[\"docker\", \"terminal\"]",
        ),
        (
            "builtin-docker-ps",
            "Docker: List with Ports",
            "docker ps -a --format \"table {{.ID}}\\t{{.Names}}\\t{{.Status}}\\t{{.Ports}}\"",
            Some("Lists all containers in a clean column layout with mapped ports."),
            "[\"docker\", \"status\"]",
        ),
        (
            "builtin-docker-prune",
            "Docker: Full Cleanup",
            "docker system prune -af --volumes",
            Some("Removes stopped containers, unused networks, dangling images and volumes."),
            "[\"docker\", \"cleanup\"]",
        ),
        (
            "builtin-compose-up",
            "Docker Compose: Up",
            "docker compose up -d {{service}}",
            Some("Starts the Compose services in the background (all of them if the service is left empty)."),
            "[\"compose\", \"start\"]",
        ),
        (
            "builtin-compose-down",
            "Docker Compose: Down",
            "docker compose down",
            Some("Stops and removes the Compose project's containers and networks."),
            "[\"compose\", \"stop\"]",
        ),
        (
            "builtin-compose-logs",
            "Docker Compose: Follow Logs",
            "docker compose logs -f --tail {{lines=100}} {{service}}",
            Some("Follows the recent logs of the Compose services in real time."),
            "[\"compose\", \"logs\"]",
        ),
        (
            "builtin-compose-ps",
            "Docker Compose: Status",
            "docker compose ps",
            Some("Lists the Compose project's containers and their state."),
            "[\"compose\", \"status\"]",
        ),
        (
            "builtin-docker-images",
            "Docker: List Images",
            "docker images",
            Some("Lists the local images with their tag, ID and size."),
            "[\"docker\", \"images\"]",
        ),
        (
            "builtin-docker-stats",
            "Docker: Resource Usage",
            "docker stats --no-stream",
            Some("Shows a one-off snapshot of CPU and memory usage per container."),
            "[\"docker\", \"status\"]",
        ),
        (
            "builtin-docker-restart",
            "Docker: Restart Container",
            "docker restart {{container}}",
            Some("Restarts the specified container."),
            "[\"docker\", \"service\"]",
        ),
        (
            "builtin-docker-top",
            "Docker: Container Processes",
            "docker top {{container}}",
            Some("Lists the processes running inside the container."),
            "[\"docker\", \"status\"]",
        ),
        (
            "builtin-sys-journal",
            "Systemd: Live Logs",
            "journalctl -u {{service}} -f -n {{lines=50}}",
            Some("Follows a system service's logs in real time with timestamps."),
            "[\"system\", \"logs\"]",
        ),
        (
            "builtin-sys-status",
            "Systemd: Service Status",
            "sudo systemctl status {{service}}",
            Some("Checks a service's run state, PID and latest log lines."),
            "[\"system\", \"service\"]",
        ),
        (
            "builtin-sys-restart",
            "Systemd: Restart Service",
            "sudo systemctl restart {{service}}",
            Some("Cleanly restarts the specified daemon or service."),
            "[\"system\", \"service\"]",
        ),
        (
            "builtin-net-listen",
            "Network: Listening Ports",
            "ss -tulpn",
            Some("Lists all listening TCP/UDP sockets with the process name and PID."),
            "[\"network\", \"ports\"]",
        ),
        (
            "builtin-net-ips",
            "Network: IP Summary",
            "ip -br -c a",
            Some("Shows network interfaces with their assigned IPv4/IPv6 addresses, in color."),
            "[\"network\", \"ip\"]",
        ),
        (
            "builtin-net-curl-hdr",
            "Network: HTTP Headers",
            "curl -I {{url=https://google.com}}",
            Some("Sends a HEAD request to inspect headers, HTTP status codes and certificates."),
            "[\"network\", \"http\"]",
        ),
        (
            "builtin-net-ufw",
            "Network: UFW Firewall Status",
            "sudo ufw status verbose",
            Some("Shows the active UFW firewall rules and allowed ports."),
            "[\"network\", \"firewall\"]",
        ),
        (
            "builtin-fs-large-files",
            "Disk: 10 Largest Files",
            "find / -type f -size +{{size=100M}} -exec ls -lh {} + 2>/dev/null | sort -k 5 -hr | head -n 10",
            Some("Finds and lists the 10 largest files on the file system."),
            "[\"storage\", \"find\"]",
        ),
        (
            "builtin-fs-space",
            "Disk: Real Partitions",
            "df -hT --exclude-type=tmpfs --exclude-type=devtmpfs",
            Some("Shows free space on physical partitions without temporary file systems."),
            "[\"storage\", \"df\"]",
        ),
        (
            "builtin-sys-mem",
            "Memory: RAM and Swap Usage",
            "free -h",
            Some("Shows physical, used, cached and swap memory in readable units."),
            "[\"system\", \"memory\"]",
        ),
        (
            "builtin-sys-dmesg",
            "Kernel: Recent Messages",
            "dmesg -T | tail -n 50",
            Some("Shows the last 50 kernel events with readable timestamps."),
            "[\"system\", \"kernel\"]",
        ),
    ];

    for (id, title, template, desc, tags_json) in builtins {
        conn.execute(
            "INSERT OR IGNORE INTO snippets (id, title, command_template, description, tags_json, is_builtin, is_enabled, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 1, 1, ?6, ?6)",
            params![id, title, template, desc, tags_json, now],
        )?;
        // Built-ins are read-only: refresh their text on existing databases (keeps is_enabled untouched).
        conn.execute(
            "UPDATE snippets SET title = ?2, command_template = ?3, description = ?4, tags_json = ?5
             WHERE id = ?1 AND is_builtin = 1",
            params![id, title, template, desc, tags_json],
        )?;
    }

    Ok(())
}

pub fn get_snippets_internal(conn: &Connection) -> Result<Vec<CommandSnippet>, VaultError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, command_template, description, tags_json, is_builtin, is_enabled, created_at, updated_at
         FROM snippets ORDER BY is_builtin DESC, title ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        let tags_json: String = row.get(4)?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        let is_builtin_int: i32 = row.get(5).unwrap_or(0);
        let is_enabled_int: i32 = row.get(6).unwrap_or(1);
        Ok(CommandSnippet {
            id: row.get(0)?,
            title: row.get(1)?,
            command_template: row.get(2)?,
            description: row.get(3)?,
            tags,
            is_builtin: is_builtin_int != 0,
            is_enabled: is_enabled_int != 0,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
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
    let is_enabled_val = if payload.is_enabled.unwrap_or(true) { 1 } else { 0 };

    let id = match &payload.id {
        Some(existing_id) => {
            conn.execute(
                "UPDATE snippets
                 SET title = ?1, command_template = ?2, description = ?3, tags_json = ?4, is_enabled = ?5, updated_at = ?6
                 WHERE id = ?7",
                params![
                    payload.title,
                    payload.command_template,
                    payload.description,
                    tags_json,
                    is_enabled_val,
                    now,
                    existing_id
                ],
            )?;
            existing_id.clone()
        }
        None => {
            let new_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO snippets (id, title, command_template, description, tags_json, is_builtin, is_enabled, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, ?7)",
                params![
                    new_id,
                    payload.title,
                    payload.command_template,
                    payload.description,
                    tags_json,
                    is_enabled_val,
                    now
                ],
            )?;
            new_id
        }
    };

    Ok(id)
}

pub fn toggle_snippet_enabled_internal(
    conn: &Connection,
    id: &str,
    enabled: bool,
) -> Result<(), VaultError> {
    let now = Utc::now().to_rfc3339();
    let enabled_int = if enabled { 1 } else { 0 };
    conn.execute(
        "UPDATE snippets SET is_enabled = ?1, updated_at = ?2 WHERE id = ?3",
        params![enabled_int, now, id],
    )?;
    Ok(())
}

pub fn delete_snippet_internal(conn: &Connection, id: &str) -> Result<(), VaultError> {
    let is_builtin: Option<i32> = conn
        .query_row(
            "SELECT is_builtin FROM snippets WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()?;

    if is_builtin == Some(1) {
        // Builtin community snippets are disabled rather than deleted
        toggle_snippet_enabled_internal(conn, id, false)
    } else {
        conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])?;
        Ok(())
    }
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
pub fn toggle_snippet_enabled(
    id: String,
    enabled: bool,
    vault_mgr: State<'_, Arc<VaultManager>>,
) -> Result<(), VaultError> {
    let conn = vault_mgr.db.lock().unwrap();
    toggle_snippet_enabled_internal(&conn, &id, enabled)
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
    fn test_seeding_refreshes_legacy_builtin_text_and_keeps_enabled_state() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();
        conn.execute(
            "UPDATE snippets SET title = 'Docker: Seguir Logs', description = 'texto antiguo', is_enabled = 0 WHERE id = 'builtin-docker-logs'",
            [],
        )
        .unwrap();

        seed_community_snippets(&conn).unwrap();

        let list = get_snippets_internal(&conn).unwrap();
        let item = list.iter().find(|s| s.id == "builtin-docker-logs").unwrap();
        assert_eq!(item.title, "Docker: Follow Logs");
        assert!(item.command_template.contains("{{lines=100}}"));
        assert!(!item.is_enabled, "user's enabled choice must be preserved");
        assert_eq!(list.len(), 23);
    }

    #[test]
    fn test_snippet_crud_and_community_seeding() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();

        // 1. Initial list has seeded community snippets
        let initial = get_snippets_internal(&conn).unwrap();
        assert_eq!(initial.len(), 23);
        let docker_logs = initial.iter().find(|s| s.id == "builtin-docker-logs").unwrap();
        assert!(docker_logs.is_builtin);
        assert!(docker_logs.is_enabled);

        // 2. Toggle enabled state of a builtin snippet
        toggle_snippet_enabled_internal(&conn, "builtin-docker-logs", false).unwrap();
        let list_after_toggle = get_snippets_internal(&conn).unwrap();
        let toggled = list_after_toggle.iter().find(|s| s.id == "builtin-docker-logs").unwrap();
        assert!(!toggled.is_enabled);

        // 3. Deleting a builtin snippet should keep it disabled instead of deleting row
        delete_snippet_internal(&conn, "builtin-docker-logs").unwrap();
        let list_after_delete_builtin = get_snippets_internal(&conn).unwrap();
        assert_eq!(list_after_delete_builtin.len(), 23);
        let disabled_builtin = list_after_delete_builtin.iter().find(|s| s.id == "builtin-docker-logs").unwrap();
        assert!(!disabled_builtin.is_enabled);

        // 4. Create custom snippet
        let payload = SaveSnippetPayload {
            id: None,
            title: "Custom Backup".to_string(),
            command_template: "tar -czvf {{dest}} {{source}}".to_string(),
            description: Some("Create tarball backup".to_string()),
            tags: vec!["backup".to_string()],
            is_enabled: Some(true),
        };

        let custom_id = save_snippet_internal(&conn, &payload).unwrap();
        assert!(!custom_id.is_empty());

        let list_with_custom = get_snippets_internal(&conn).unwrap();
        assert_eq!(list_with_custom.len(), 24);
        let custom_item = list_with_custom.iter().find(|s| s.id == custom_id).unwrap();
        assert!(!custom_item.is_builtin);
        assert!(custom_item.is_enabled);

        // 5. Update custom snippet
        let mut update_payload = payload.clone();
        update_payload.id = Some(custom_id.clone());
        update_payload.title = "Custom Backup v2".to_string();

        let updated_id = save_snippet_internal(&conn, &update_payload).unwrap();
        assert_eq!(updated_id, custom_id);

        // 6. Delete custom snippet completely removes it
        delete_snippet_internal(&conn, &custom_id).unwrap();
        let list_after_custom_delete = get_snippets_internal(&conn).unwrap();
        assert_eq!(list_after_custom_delete.len(), 23);
        assert!(list_after_custom_delete.iter().all(|s| s.id != custom_id));
    }
}
