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
            "Docker: Seguir Logs",
            "docker logs -f --tail {{lineas=100}} {{contenedor}}",
            Some("Muestra y sigue los logs recientes del contenedor en tiempo real."),
            "[\"docker\", \"logs\"]",
        ),
        (
            "builtin-docker-exec",
            "Docker: Shell Interactiva",
            "docker exec -it {{contenedor}} /bin/sh",
            Some("Abre una terminal interactiva dentro del contenedor en ejecución."),
            "[\"docker\", \"terminal\"]",
        ),
        (
            "builtin-docker-ps",
            "Docker: Lista con Puertos",
            "docker ps -a --format \"table {{.ID}}\\t{{.Names}}\\t{{.Status}}\\t{{.Ports}}\"",
            Some("Muestra todos los contenedores con formato limpio de columnas y puertos mapeados."),
            "[\"docker\", \"status\"]",
        ),
        (
            "builtin-docker-prune",
            "Docker: Limpieza Total",
            "docker system prune -af --volumes",
            Some("Elimina contenedores detenidos, redes sin uso, imágenes huérfanas y volúmenes."),
            "[\"docker\", \"cleanup\"]",
        ),
        (
            "builtin-sys-journal",
            "Systemd: Logs en Vivo",
            "journalctl -u {{servicio}} -f -n {{lineas=50}}",
            Some("Sigue los logs del servicio del sistema en tiempo real con marcas de tiempo."),
            "[\"system\", \"logs\"]",
        ),
        (
            "builtin-sys-status",
            "Systemd: Estado de Servicio",
            "sudo systemctl status {{servicio}}",
            Some("Verifica el estado de ejecución, PID y últimas líneas de log de un servicio."),
            "[\"system\", \"service\"]",
        ),
        (
            "builtin-sys-restart",
            "Systemd: Reiniciar Servicio",
            "sudo systemctl restart {{servicio}}",
            Some("Reinicia limpiamente el demonio o servicio especificado."),
            "[\"system\", \"service\"]",
        ),
        (
            "builtin-net-listen",
            "Red: Puertos Escuchando",
            "ss -tulpn",
            Some("Muestra todos los sockets TCP/UDP abiertos a la escucha con el nombre y PID del proceso."),
            "[\"network\", \"ports\"]",
        ),
        (
            "builtin-net-ips",
            "Red: Resumen de IPs",
            "ip -br -c a",
            Some("Muestra las interfaces de red con sus direcciones IPv4/IPv6 asignadas y colores."),
            "[\"network\", \"ip\"]",
        ),
        (
            "builtin-net-curl-hdr",
            "Red: Cabeceras HTTP",
            "curl -I {{url=https://google.com}}",
            Some("Realiza una petición HEAD para inspeccionar cabeceras, códigos HTTP y certificados."),
            "[\"network\", \"http\"]",
        ),
        (
            "builtin-net-ufw",
            "Red: Estado Firewall UFW",
            "sudo ufw status verbose",
            Some("Muestra las reglas activas del cortafuegos UFW y puertos permitidos."),
            "[\"network\", \"firewall\"]",
        ),
        (
            "builtin-fs-large-files",
            "Disco: 10 Archivos Más Pesados",
            "find / -type f -size +{{tamano=100M}} -exec ls -lh {} + 2>/dev/null | sort -k 5 -hr | head -n 10",
            Some("Busca y lista los 10 archivos de mayor tamaño en el sistema de archivos."),
            "[\"storage\", \"find\"]",
        ),
        (
            "builtin-fs-space",
            "Disco: Particiones Reales",
            "df -hT --exclude-type=tmpfs --exclude-type=devtmpfs",
            Some("Muestra el espacio libre en particiones físicas sin el ruido de sistemas temporales."),
            "[\"storage\", \"df\"]",
        ),
        (
            "builtin-sys-mem",
            "Memoria: Uso de RAM y Swap",
            "free -h",
            Some("Muestra la memoria física, usada, en caché y swap en unidades legibles."),
            "[\"system\", \"memory\"]",
        ),
        (
            "builtin-sys-dmesg",
            "Kernel: Mensajes Recientes",
            "dmesg -T | tail -n 50",
            Some("Muestra los últimos 50 eventos del kernel con marcas de tiempo legibles."),
            "[\"system\", \"kernel\"]",
        ),
    ];

    for (id, title, template, desc, tags_json) in builtins {
        conn.execute(
            "INSERT OR IGNORE INTO snippets (id, title, command_template, description, tags_json, is_builtin, is_enabled, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 1, 1, ?6, ?6)",
            params![id, title, template, desc, tags_json, now],
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
    fn test_snippet_crud_and_community_seeding() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();

        // 1. Initial list has seeded community snippets
        let initial = get_snippets_internal(&conn).unwrap();
        assert_eq!(initial.len(), 15);
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
        assert_eq!(list_after_delete_builtin.len(), 15);
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
        assert_eq!(list_with_custom.len(), 16);
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
        assert_eq!(list_after_custom_delete.len(), 15);
        assert!(list_after_custom_delete.iter().all(|s| s.id != custom_id));
    }
}
