use super::*;
use crate::vault::db::VaultManager;

fn db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    VaultManager::run_migrations(&conn).unwrap();
    conn
}

const NOW: &str = "2026-01-01T00:00:00Z";

fn folder(c: &Connection, id: &str) {
    c.execute("INSERT INTO folders (id, name, updated_at) VALUES (?1, 'f', ?2)", params![id, NOW]).unwrap();
}
fn host(c: &Connection, id: &str, folder_id: Option<&str>) {
    c.execute(
        "INSERT INTO hosts (id, folder_id, label, hostname, port, updated_at) VALUES (?1, ?2, 'l', 'secret-host.lan', 22, ?3)",
        params![id, folder_id, NOW],
    )
    .unwrap();
}
fn tunnel(c: &Connection, id: &str, host_id: &str) {
    c.execute(
        "INSERT INTO ssh_tunnels (id, host_id, name, tunnel_type, local_port, created_at, updated_at) VALUES (?1, ?2, 't', 'local', 8080, ?3, ?3)",
        params![id, host_id, NOW],
    )
    .unwrap();
}
fn snippet(c: &Connection, id: &str) {
    c.execute(
        "INSERT INTO snippets (id, title, command_template, tags_json, is_builtin, is_enabled, created_at, updated_at) VALUES (?1, 'T', 'ls', '[]', 0, 1, ?2, ?2)",
        params![id, NOW],
    )
    .unwrap();
}
fn synced_all(c: &Connection) {
    for p in pending_changes(c).unwrap() {
        mark_synced(c, p.kind, &p.id, p.rev, p.deleted).unwrap();
    }
}
fn ids(c: &Connection) -> Vec<(String, String, bool)> {
    pending_changes(c).unwrap().into_iter().map(|p| (p.kind.as_str().to_string(), p.id, p.deleted)).collect()
}
fn key() -> Key {
    Key::generate()
}

#[test]
fn migration_is_idempotent_and_keeps_device_id() {
    let c = db();
    let dev: String = c.query_row("SELECT device_id FROM sync_state WHERE id = 1", [], |r| r.get(0)).unwrap();
    migrate(&c).unwrap();
    migrate(&c).unwrap();
    VaultManager::run_migrations(&c).unwrap();
    let dev2: String = c.query_row("SELECT device_id FROM sync_state WHERE id = 1", [], |r| r.get(0)).unwrap();
    assert_eq!(dev, dev2);
    assert!(!dev.is_empty());
}

#[test]
fn legacy_vault_gets_columns_and_existing_records_become_pending() {
    let c = db();
    folder(&c, "f1");
    host(&c, "h1", Some("f1"));
    synced_all(&c);
    assert!(ids(&c).is_empty());
    // Simula una bóveda anterior a la sincronización.
    for k in SyncKind::ALL {
        let t = k.table();
        for suffix in ["ins", "upd", "del"] {
            c.execute(&format!("DROP TRIGGER trg_sync_{}_{suffix}", k.as_str()), []).unwrap();
        }
        c.execute(&format!("ALTER TABLE {t} DROP COLUMN sync_rev"), []).unwrap();
        c.execute(&format!("ALTER TABLE {t} DROP COLUMN sync_dirty"), []).unwrap();
    }
    c.execute_batch("DROP TABLE sync_state; DROP TABLE sync_tombstones;").unwrap();
    migrate(&c).unwrap();
    assert_eq!(ids(&c), vec![
        ("folder".into(), "f1".into(), false),
        ("host".into(), "h1".into(), false),
    ]);
}

#[test]
fn insert_and_update_mark_pending_with_next_revision() {
    let c = db();
    host(&c, "h1", None);
    assert_eq!(pending_changes(&c).unwrap(), vec![Pending { kind: SyncKind::Host, id: "h1".into(), rev: 1, deleted: false }]);
    synced_all(&c);
    assert!(pending_changes(&c).unwrap().is_empty());
    c.execute("UPDATE hosts SET label = 'new' WHERE id = 'h1'", []).unwrap();
    assert_eq!(pending_changes(&c).unwrap(), vec![Pending { kind: SyncKind::Host, id: "h1".into(), rev: 2, deleted: false }]);
}

#[test]
fn mark_synced_does_not_retrigger() {
    let c = db();
    host(&c, "h1", None);
    mark_synced(&c, SyncKind::Host, "h1", 1, false).unwrap();
    assert!(pending_changes(&c).unwrap().is_empty());
    let rev: i64 = c.query_row("SELECT sync_rev FROM hosts WHERE id = 'h1'", [], |r| r.get(0)).unwrap();
    assert_eq!(rev, 1);
}

#[test]
fn delete_leaves_tombstone_until_synced() {
    let c = db();
    host(&c, "h1", None);
    synced_all(&c);
    c.execute("DELETE FROM hosts WHERE id = 'h1'", []).unwrap();
    assert_eq!(pending_changes(&c).unwrap(), vec![Pending { kind: SyncKind::Host, id: "h1".into(), rev: 2, deleted: true }]);
    synced_all(&c);
    assert!(pending_changes(&c).unwrap().is_empty());
}

#[test]
fn cascade_delete_tombstones_children() {
    let c = db();
    host(&c, "h1", None);
    tunnel(&c, "t1", "h1");
    synced_all(&c);
    c.execute("DELETE FROM hosts WHERE id = 'h1'", []).unwrap();
    let got = ids(&c);
    assert!(got.contains(&("host".into(), "h1".into(), true)));
    assert!(got.contains(&("tunnel".into(), "t1".into(), true)));
}

#[test]
fn set_null_cascade_marks_the_child_as_modified() {
    let c = db();
    folder(&c, "f1");
    host(&c, "h1", Some("f1"));
    synced_all(&c);
    c.execute("DELETE FROM folders WHERE id = 'f1'", []).unwrap();
    let got = ids(&c);
    assert!(got.contains(&("folder".into(), "f1".into(), true)));
    assert!(got.contains(&("host".into(), "h1".into(), false)));
}

#[test]
fn recreating_a_record_clears_its_tombstone() {
    let c = db();
    host(&c, "h1", None);
    synced_all(&c);
    c.execute("DELETE FROM hosts WHERE id = 'h1'", []).unwrap();
    host(&c, "h1", None);
    assert_eq!(ids(&c), vec![("host".into(), "h1".into(), false)]);
}

#[test]
fn builtin_snippets_are_never_tracked() {
    let c = db();
    // Los integrados se siembran en la migración: no deben aparecer.
    assert!(ids(&c).iter().all(|(k, _, _)| k != "snippet"));
    c.execute("UPDATE snippets SET is_enabled = 0 WHERE id = 'builtin-docker-logs'", []).unwrap();
    crate::snippets::seed_community_snippets(&c).unwrap();
    assert!(ids(&c).iter().all(|(k, _, _)| k != "snippet"));
    assert!(c.query_row("SELECT COUNT(*) FROM sync_tombstones", [], |r| r.get::<_, i64>(0)).unwrap() == 0);
    snippet(&c, "mine");
    assert_eq!(ids(&c), vec![("snippet".into(), "mine".into(), false)]);
    c.execute("DELETE FROM snippets WHERE id = 'mine'", []).unwrap();
    assert_eq!(ids(&c), vec![("snippet".into(), "mine".into(), true)]);
}

#[test]
fn changes_applied_from_the_server_are_not_marked() {
    let c = db();
    host(&c, "h1", None);
    synced_all(&c);
    set_applying(&c, true).unwrap();
    c.execute(
        "INSERT INTO hosts (id, label, hostname, port, updated_at, sync_rev, sync_dirty) VALUES ('h2', 'l', 'x', 22, ?1, 5, 0)",
        params![NOW],
    )
    .unwrap();
    c.execute("UPDATE hosts SET label = 'remote' WHERE id = 'h1'", []).unwrap();
    c.execute("DELETE FROM hosts WHERE id = 'h2'", []).unwrap();
    set_applying(&c, false).unwrap();
    assert!(pending_changes(&c).unwrap().is_empty());
    assert_eq!(c.query_row("SELECT COUNT(*) FROM sync_tombstones", [], |r| r.get::<_, i64>(0)).unwrap(), 0);
    // y al terminar vuelve a registrarse lo local
    c.execute("UPDATE hosts SET label = 'local' WHERE id = 'h1'", []).unwrap();
    assert_eq!(ids(&c), vec![("host".into(), "h1".into(), false)]);
}

#[test]
fn pending_order_puts_parents_before_children() {
    let c = db();
    snippet(&c, "s1");
    tunnel_after_host(&c);
    let kinds: Vec<String> = ids(&c).into_iter().map(|(k, _, _)| k).collect();
    let pos = |k: &str| kinds.iter().position(|x| x == k).unwrap();
    assert!(pos("folder") < pos("host") && pos("host") < pos("tunnel") && pos("tunnel") < pos("snippet"));
}
fn tunnel_after_host(c: &Connection) {
    tunnel_chain(c);
}
fn tunnel_chain(c: &Connection) {
    // creados en orden inverso a propósito
    folder(c, "f1");
    host(c, "h1", Some("f1"));
    tunnel(c, "t1", "h1");
}

#[test]
fn sealed_record_round_trips_and_leaks_no_plaintext() {
    let c = db();
    host(&c, "h1", None);
    c.execute("UPDATE hosts SET encrypted_notes = x'DEADBEEF' WHERE id = 'h1'", []).unwrap();
    let k = key();
    let env = seal_record(&c, &k, SyncKind::Host, "h1").unwrap();
    assert_eq!((env.kind.as_str(), env.id.as_str(), env.rev, env.deleted), ("host", "h1", 1, false));
    let json = serde_json::to_string(&env).unwrap();
    assert!(!json.contains("secret-host.lan"));
    let value = open_record(&k, &env).unwrap();
    assert_eq!(value["hostname"], "secret-host.lan");
    assert_eq!(value["encrypted_notes"], "b64:3q2+7w==");
    assert!(value.get("sync_rev").is_none() && value.get("sync_dirty").is_none());
    assert!(open_record(&key(), &env).is_err());
}

#[test]
fn sealed_identity_keeps_encrypted_secret_as_opaque_blob() {
    let c = db();
    c.execute(
        "INSERT INTO identities (id, name, username, auth_type, encrypted_secret, updated_at) VALUES ('i1', 'n', 'root', 'password', x'0102', ?1)",
        params![NOW],
    )
    .unwrap();
    let k = key();
    let v = open_record(&k, &seal_record(&c, &k, SyncKind::Identity, "i1").unwrap()).unwrap();
    assert_eq!(v["encrypted_secret"], "b64:AQI=");
}

#[test]
fn sealed_tombstone_is_authenticated() {
    let c = db();
    host(&c, "h1", None);
    synced_all(&c);
    c.execute("DELETE FROM hosts WHERE id = 'h1'", []).unwrap();
    let k = key();
    let env = seal_tombstone(&c, &k, SyncKind::Host, "h1").unwrap();
    assert!(env.deleted && env.rev == 2);
    assert_eq!(open_record(&k, &env).unwrap(), Value::Null);
}

#[test]
fn builtin_or_missing_records_cannot_be_sealed() {
    let c = db();
    let k = key();
    assert!(seal_record(&c, &k, SyncKind::Snippet, "builtin-docker-logs").is_err());
    assert!(seal_record(&c, &k, SyncKind::Host, "nope").is_err());
    assert!(seal_tombstone(&c, &k, SyncKind::Host, "nope").is_err());
}

#[test]
fn vault_key_converts_to_envelope_key() {
    let vk = VaultKey::generate_random();
    let k = to_sync_key(&vk);
    assert_eq!(&k.0, vk.as_bytes());
}
