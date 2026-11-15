use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::vault::db::VaultError;
use super::models::{TunnelConfig, TunnelConfigPayload, TunnelType};

pub fn get_tunnels_internal(
    conn: &Connection,
    host_id: Option<&str>,
) -> Result<Vec<TunnelConfig>, VaultError> {
    let sql = match host_id {
        Some(_) => {
            "SELECT id, host_id, name, tunnel_type, local_host, local_port, remote_host, remote_port, auto_start, created_at, updated_at
             FROM ssh_tunnels WHERE host_id = ?1 ORDER BY name ASC"
        }
        None => {
            "SELECT id, host_id, name, tunnel_type, local_host, local_port, remote_host, remote_port, auto_start, created_at, updated_at
             FROM ssh_tunnels ORDER BY name ASC"
        }
    };

    let mut stmt = conn.prepare(sql)?;
    let map_row = |row: &rusqlite::Row| {
        let t_type_str: String = row.get(3)?;
        let tunnel_type = TunnelType::from_str(&t_type_str).unwrap_or(TunnelType::Local);
        let auto_start_int: i32 = row.get(8)?;

        Ok(TunnelConfig {
            id: row.get(0)?,
            host_id: row.get(1)?,
            name: row.get(2)?,
            tunnel_type,
            local_host: row.get(4)?,
            local_port: row.get::<_, u32>(5)? as u16,
            remote_host: row.get(6)?,
            remote_port: row.get::<_, Option<u32>>(7)?.map(|p| p as u16),
            auto_start: auto_start_int == 1,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    };

    let rows = match host_id {
        Some(h_id) => stmt.query_map(params![h_id], map_row)?,
        None => stmt.query_map([], map_row)?,
    };

    let mut tunnels = Vec::new();
    for t in rows {
        tunnels.push(t?);
    }
    Ok(tunnels)
}

pub fn get_tunnel_by_id_internal(
    conn: &Connection,
    id: &str,
) -> Result<Option<TunnelConfig>, VaultError> {
    let mut stmt = conn.prepare(
        "SELECT id, host_id, name, tunnel_type, local_host, local_port, remote_host, remote_port, auto_start, created_at, updated_at
         FROM ssh_tunnels WHERE id = ?1",
    )?;

    stmt.query_row(params![id], |row| {
        let t_type_str: String = row.get(3)?;
        let tunnel_type = TunnelType::from_str(&t_type_str).unwrap_or(TunnelType::Local);
        let auto_start_int: i32 = row.get(8)?;

        Ok(TunnelConfig {
            id: row.get(0)?,
            host_id: row.get(1)?,
            name: row.get(2)?,
            tunnel_type,
            local_host: row.get(4)?,
            local_port: row.get::<_, u32>(5)? as u16,
            remote_host: row.get(6)?,
            remote_port: row.get::<_, Option<u32>>(7)?.map(|p| p as u16),
            auto_start: auto_start_int == 1,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })
    .optional()
    .map_err(VaultError::DbError)
}

pub fn save_tunnel_internal(
    conn: &Connection,
    payload: &TunnelConfigPayload,
) -> Result<TunnelConfig, VaultError> {
    let now = Utc::now().to_rfc3339();
    let local_host = payload.local_host.as_deref().unwrap_or("127.0.0.1");
    let auto_start_val = if payload.auto_start.unwrap_or(false) { 1 } else { 0 };

    let id = match &payload.id {
        Some(existing_id) => {
            conn.execute(
                "UPDATE ssh_tunnels
                 SET host_id = ?1, name = ?2, tunnel_type = ?3, local_host = ?4, local_port = ?5,
                     remote_host = ?6, remote_port = ?7, auto_start = ?8, updated_at = ?9
                 WHERE id = ?10",
                params![
                    payload.host_id,
                    payload.name,
                    payload.tunnel_type.as_str(),
                    local_host,
                    payload.local_port as u32,
                    payload.remote_host,
                    payload.remote_port.map(|p| p as u32),
                    auto_start_val,
                    now,
                    existing_id,
                ],
            )?;
            existing_id.clone()
        }
        None => {
            let new_id = Uuid::now_v7().to_string();
            conn.execute(
                "INSERT INTO ssh_tunnels (id, host_id, name, tunnel_type, local_host, local_port, remote_host, remote_port, auto_start, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
                    new_id,
                    payload.host_id,
                    payload.name,
                    payload.tunnel_type.as_str(),
                    local_host,
                    payload.local_port as u32,
                    payload.remote_host,
                    payload.remote_port.map(|p| p as u32),
                    auto_start_val,
                    now,
                    now,
                ],
            )?;
            new_id
        }
    };

    get_tunnel_by_id_internal(conn, &id)?
        .ok_or_else(|| VaultError::DbError(rusqlite::Error::QueryReturnedNoRows))
}

pub fn delete_tunnel_internal(conn: &Connection, id: &str) -> Result<(), VaultError> {
    conn.execute("DELETE FROM ssh_tunnels WHERE id = ?1", params![id])?;
    Ok(())
}
