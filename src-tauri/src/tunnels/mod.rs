pub mod commands;
pub mod db;
pub mod manager;
pub mod models;
pub mod socks5;

#[cfg(test)]
mod tests {
    use super::db::*;
    use super::models::*;
    use rusqlite::Connection;
    use crate::vault::db::VaultManager;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();
        // Insert a dummy host for foreign key constraint
        conn.execute(
            "INSERT INTO hosts (id, label, hostname, port, updated_at) VALUES ('host-1', 'Server 1', '127.0.0.1', 22, '2026-01-01T00:00:00Z')",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn test_tunnel_crud_lifecycle() {
        let conn = setup_test_db();

        // 1. Create a local tunnel
        let payload = TunnelConfigPayload {
            id: None,
            host_id: "host-1".to_string(),
            name: "Postgres Tunnel".to_string(),
            tunnel_type: TunnelType::Local,
            local_host: Some("127.0.0.1".to_string()),
            local_port: 5433,
            remote_host: Some("127.0.0.1".to_string()),
            remote_port: Some(5432),
            auto_start: Some(false),
        };

        let created = save_tunnel_internal(&conn, &payload).expect("Failed to create tunnel");
        assert_eq!(created.name, "Postgres Tunnel");
        assert_eq!(created.local_port, 5433);
        assert_eq!(created.tunnel_type, TunnelType::Local);

        // 2. List tunnels
        let tunnels = get_tunnels_internal(&conn, None).unwrap();
        assert_eq!(tunnels.len(), 1);
        assert_eq!(tunnels[0].id, created.id);

        // 3. Update tunnel
        let update_payload = TunnelConfigPayload {
            id: Some(created.id.clone()),
            host_id: "host-1".to_string(),
            name: "Postgres Production".to_string(),
            tunnel_type: TunnelType::Local,
            local_host: Some("127.0.0.1".to_string()),
            local_port: 5434,
            remote_host: Some("10.0.0.5".to_string()),
            remote_port: Some(5432),
            auto_start: Some(true),
        };
        let updated = save_tunnel_internal(&conn, &update_payload).expect("Failed to update tunnel");
        assert_eq!(updated.name, "Postgres Production");
        assert_eq!(updated.local_port, 5434);
        assert_eq!(updated.remote_host, Some("10.0.0.5".to_string()));
        assert!(updated.auto_start);

        // 4. Delete tunnel
        delete_tunnel_internal(&conn, &created.id).expect("Failed to delete tunnel");
        let remaining = get_tunnels_internal(&conn, None).unwrap();
        assert_eq!(remaining.len(), 0);
    }
}
