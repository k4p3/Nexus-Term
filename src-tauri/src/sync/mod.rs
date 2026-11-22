//! Base de la sincronización: seguimiento local de cambios y borrados, y sellado/apertura de registros.
//! No hace E/S de red ni expone comandos; el motor y la interfaz llegan en cambios posteriores.
use crate::vault::crypto::VaultKey;
use crate::vault::db::VaultError;
use base64::{engine::general_purpose::STANDARD, Engine};
use nexus_sync_proto::envelope::Envelope;
use nexus_sync_proto::Key;
use rusqlite::{params, types::ValueRef, Connection, OptionalExtension};
use serde_json::{json, Map, Value};

/// Tipos de registro que se sincronizan, en orden de dependencias (los padres primero).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SyncKind {
    Folder,
    Identity,
    Host,
    Tunnel,
    Snippet,
}

impl SyncKind {
    pub const ALL: [SyncKind; 5] = [Self::Folder, Self::Identity, Self::Host, Self::Tunnel, Self::Snippet];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Folder => "folder",
            Self::Identity => "identity",
            Self::Host => "host",
            Self::Tunnel => "tunnel",
            Self::Snippet => "snippet",
        }
    }
    pub fn from_str(s: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|k| k.as_str() == s)
    }
    pub fn table(self) -> &'static str {
        match self {
            Self::Folder => "folders",
            Self::Identity => "identities",
            Self::Host => "hosts",
            Self::Tunnel => "ssh_tunnels",
            Self::Snippet => "snippets",
        }
    }
    /// Condición extra para excluir filas que nunca se sincronizan (snippets integrados).
    fn filter(self) -> &'static str {
        if self == Self::Snippet { " AND is_builtin = 0" } else { "" }
    }
}

/// Cambio local pendiente de subir.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pending {
    pub kind: SyncKind,
    pub id: String,
    /// Revisión que tendrá el registro al subirse (la sincronizada + 1).
    pub rev: u64,
    pub deleted: bool,
}

fn has_column(conn: &Connection, table: &str, col: &str) -> Result<bool, VaultError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2",
        params![table, col],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

/// Migración idempotente: `sync_state`, `sync_tombstones`, columnas `sync_rev`/`sync_dirty` y disparadores.
pub fn migrate(conn: &Connection) -> Result<(), VaultError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS sync_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            device_id TEXT NOT NULL,
            server_url TEXT,
            last_seq INTEGER NOT NULL DEFAULT 0,
            applying INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sync_tombstones (
            kind TEXT NOT NULL,
            id TEXT NOT NULL,
            rev INTEGER NOT NULL DEFAULT 0,
            deleted_at TEXT NOT NULL,
            PRIMARY KEY (kind, id)
        );",
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO sync_state (id, device_id) VALUES (1, ?1)",
        params![uuid::Uuid::new_v4().to_string()],
    )?;

    for kind in SyncKind::ALL {
        let t = kind.table();
        if !has_column(conn, t, "sync_rev")? {
            conn.execute(&format!("ALTER TABLE {t} ADD COLUMN sync_rev INTEGER NOT NULL DEFAULT 0"), [])?;
        }
        if !has_column(conn, t, "sync_dirty")? {
            // Los registros existentes quedan pendientes: se suben en la primera sincronización.
            conn.execute(&format!("ALTER TABLE {t} ADD COLUMN sync_dirty INTEGER NOT NULL DEFAULT 1"), [])?;
        }
        let k = kind.as_str();
        let when_builtin = if kind == SyncKind::Snippet { " AND NEW.is_builtin = 0" } else { "" };
        let when_builtin_old = if kind == SyncKind::Snippet { " AND OLD.is_builtin = 0" } else { "" };
        let not_applying = "(SELECT applying FROM sync_state WHERE id = 1) = 0";
        conn.execute_batch(&format!(
            "CREATE TRIGGER IF NOT EXISTS trg_sync_{k}_ins AFTER INSERT ON {t}
             WHEN {not_applying}{when_builtin}
             BEGIN
               UPDATE {t} SET sync_dirty = 1 WHERE id = NEW.id;
               DELETE FROM sync_tombstones WHERE kind = '{k}' AND id = NEW.id;
             END;
             CREATE TRIGGER IF NOT EXISTS trg_sync_{k}_upd AFTER UPDATE ON {t}
             WHEN NEW.sync_dirty = OLD.sync_dirty AND NEW.sync_rev = OLD.sync_rev AND {not_applying}{when_builtin}
             BEGIN
               UPDATE {t} SET sync_dirty = 1 WHERE id = NEW.id;
             END;
             CREATE TRIGGER IF NOT EXISTS trg_sync_{k}_del AFTER DELETE ON {t}
             WHEN {not_applying}{when_builtin_old}
             BEGIN
               INSERT OR REPLACE INTO sync_tombstones (kind, id, rev, deleted_at)
               VALUES ('{k}', OLD.id, OLD.sync_rev, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
             END;"
        ))?;
    }
    Ok(())
}

/// Marca (o desmarca) que se están aplicando cambios del servidor: no generan pendientes ni tombstones.
pub fn set_applying(conn: &Connection, applying: bool) -> Result<(), VaultError> {
    conn.execute("UPDATE sync_state SET applying = ?1 WHERE id = 1", params![applying as i64])?;
    Ok(())
}

/// Cambios locales pendientes: registros modificados y borrados, con padres antes que hijos.
pub fn pending_changes(conn: &Connection) -> Result<Vec<Pending>, VaultError> {
    let mut out = Vec::new();
    for kind in SyncKind::ALL {
        let sql = format!("SELECT id, sync_rev FROM {} WHERE sync_dirty = 1{} ORDER BY id", kind.table(), kind.filter());
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))?;
        for row in rows {
            let (id, rev) = row?;
            out.push(Pending { kind, id, rev: rev as u64 + 1, deleted: false });
        }
    }
    let mut stmt = conn.prepare("SELECT kind, id, rev FROM sync_tombstones ORDER BY deleted_at, id")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, i64>(2)?)))?;
    for row in rows {
        let (k, id, rev) = row?;
        if let Some(kind) = SyncKind::from_str(&k) {
            out.push(Pending { kind, id, rev: rev as u64 + 1, deleted: true });
        }
    }
    Ok(out)
}

/// Tras subir con éxito: fija la revisión sincronizada y limpia el estado pendiente.
pub fn mark_synced(conn: &Connection, kind: SyncKind, id: &str, rev: u64, deleted: bool) -> Result<(), VaultError> {
    if deleted {
        conn.execute("DELETE FROM sync_tombstones WHERE kind = ?1 AND id = ?2", params![kind.as_str(), id])?;
    } else {
        conn.execute(
            &format!("UPDATE {} SET sync_rev = ?1, sync_dirty = 0 WHERE id = ?2", kind.table()),
            params![rev as i64, id],
        )?;
    }
    Ok(())
}

fn row_to_json(conn: &Connection, kind: SyncKind, id: &str) -> Result<Option<(Value, String)>, VaultError> {
    let sql = format!("SELECT * FROM {} WHERE id = ?1{}", kind.table(), kind.filter());
    let mut stmt = conn.prepare(&sql)?;
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let row = stmt
        .query_row(params![id], |r| {
            let mut map = Map::new();
            let mut updated = String::new();
            for (i, name) in names.iter().enumerate() {
                if name == "sync_rev" || name == "sync_dirty" {
                    continue;
                }
                let v = match r.get_ref(i)? {
                    ValueRef::Null => Value::Null,
                    ValueRef::Integer(n) => json!(n),
                    ValueRef::Real(f) => json!(f),
                    ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
                    ValueRef::Blob(b) => Value::String(format!("b64:{}", STANDARD.encode(b))),
                };
                if name == "updated_at" {
                    if let Value::String(s) = &v {
                        updated = s.clone();
                    }
                }
                map.insert(name.clone(), v);
            }
            Ok((Value::Object(map), updated))
        })
        .optional()?;
    Ok(row)
}

fn err(msg: &str) -> VaultError {
    VaultError::ValidationError(msg.to_string())
}

/// Convierte la clave de la bóveda local en la clave del sobre (copia que se borra al soltarse).
pub fn to_sync_key(vault_key: &VaultKey) -> Key {
    Key(*vault_key.as_bytes())
}

/// Sella un registro pendiente (completo, cifrado) listo para subir.
pub fn seal_record(conn: &Connection, key: &Key, kind: SyncKind, id: &str) -> Result<Envelope, VaultError> {
    let rev: i64 = conn
        .query_row(&format!("SELECT sync_rev FROM {} WHERE id = ?1", kind.table()), params![id], |r| r.get(0))
        .optional()?
        .ok_or_else(|| err("record not found"))?;
    let (value, updated_at) = row_to_json(conn, kind, id)?.ok_or_else(|| err("record is not synchronizable"))?;
    let plaintext = serde_json::to_vec(&value).map_err(|_| err("serialization failed"))?;
    Envelope::seal(key, kind.as_str(), id, rev as u64 + 1, &updated_at, &plaintext).map_err(|_| err("seal failed"))
}

/// Sella el tombstone de un registro borrado.
pub fn seal_tombstone(conn: &Connection, key: &Key, kind: SyncKind, id: &str) -> Result<Envelope, VaultError> {
    let (rev, at): (i64, String) = conn
        .query_row(
            "SELECT rev, deleted_at FROM sync_tombstones WHERE kind = ?1 AND id = ?2",
            params![kind.as_str(), id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| err("tombstone not found"))?;
    Envelope::seal_tombstone(key, kind.as_str(), id, rev as u64 + 1, &at).map_err(|_| err("seal failed"))
}

/// Abre un sobre recibido y devuelve el registro como JSON (la aplicación al esquema la hace el motor).
pub fn open_record(key: &Key, envelope: &Envelope) -> Result<Value, VaultError> {
    let bytes = envelope.open(key).map_err(|_| err("cannot open envelope"))?;
    if envelope.deleted {
        return Ok(Value::Null);
    }
    serde_json::from_slice(&bytes).map_err(|_| err("invalid record"))
}

#[cfg(test)]
mod tests;
