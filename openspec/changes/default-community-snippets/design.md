# Diseño Técnico: Biblioteca de Snippets Comunitarios y Gestión de Estado

## 1. Migración y Esquema SQLite

Se actualiza la tabla `snippets` en `src-tauri/src/vault/db.rs` mediante una migración segura que añade los campos `is_builtin` e `is_enabled`:

```sql
-- Migración condicional de columnas si no existen
ALTER TABLE snippets ADD COLUMN is_builtin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE snippets ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1;
```

### Struct Rust Actualizado (`src-tauri/src/snippets.rs`)
```rust
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
```

---

## 2. Catálogo de Siembra Idempotente (*Community Seed Catalog*)

Para evitar duplicaciones y permitir que el usuario mantenga el estado (por ejemplo, si deshabilitó un snippet), los snippets comunitarios utilizan **IDs deterministas fijos con prefijo `builtin-`**:

| ID | Título | Plantilla | Tags |
|---|---|---|---|
| `builtin-docker-logs` | Docker: Seguir Logs | `docker logs -f --tail {{lineas=100}} {{contenedor}}` | `["docker", "logs"]` |
| `builtin-docker-exec` | Docker: Shell Interactiva | `docker exec -it {{contenedor}} /bin/sh` | `["docker", "terminal"]` |
| `builtin-docker-ps` | Docker: Lista con Puertos | `docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"` | `["docker", "status"]` |
| `builtin-docker-prune` | Docker: Limpieza Total | `docker system prune -af --volumes` | `["docker", "cleanup"]` |
| `builtin-sys-journal` | Systemd: Logs en Vivo | `journalctl -u {{servicio}} -f -n {{lineas=50}}` | `["system", "logs"]` |
| `builtin-sys-status` | Systemd: Estado de Servicio | `sudo systemctl status {{servicio}}` | `["system", "service"]` |
| `builtin-sys-restart` | Systemd: Reiniciar Servicio | `sudo systemctl restart {{servicio}}` | `["system", "service"]` |
| `builtin-net-listen` | Red: Puertos Escuchando | `ss -tulpn` | `["network", "ports"]` |
| `builtin-net-ips` | Red: Resumen de IPs | `ip -br -c a` | `["network", "ip"]` |
| `builtin-net-curl-hdr` | Red: Cabeceras HTTP | `curl -I {{url=https://google.com}}` | `["network", "http"]` |
| `builtin-net-ufw` | Red: Estado Firewall UFW | `sudo ufw status verbose` | `["network", "firewall"]` |
| `builtin-fs-large-files` | Disco: 10 Archivos Más Pesados | `find / -type f -size +{{tamano=100M}} -exec ls -lh {} + 2>/dev/null \| sort -k 5 -hr \| head -n 10` | `["storage", "find"]` |
| `builtin-fs-space` | Disco: Particiones Reales | `df -hT --exclude-type=tmpfs --exclude-type=devtmpfs` | `["storage", "df"]` |
| `builtin-sys-mem` | Memoria: Uso de RAM y Swap | `free -h` | `["system", "memory"]` |
| `builtin-sys-dmesg` | Kernel: Mensajes Recientes | `dmesg -T \| tail -n 50` | `["system", "kernel"]` |

### Regla de Inserción
En el arranque o migración, se ejecuta:
```sql
INSERT OR IGNORE INTO snippets (id, title, command_template, description, tags_json, is_builtin, is_enabled, created_at, updated_at)
VALUES (?1, ?2, ?3, ?4, ?5, 1, 1, ?6, ?6);
```
`INSERT OR IGNORE` garantiza que si el usuario ya modificó `is_enabled` a `0`, su preferencia nunca se sobreescribe en futuras actualizaciones.

---

## 3. Contratos IPC y Métodos de Tauri

- `get_snippets()`: Retorna `Vec<CommandSnippet>` incluyendo `is_builtin` e `is_enabled`.
- `save_snippet(payload)`: Guarda o actualiza un snippet. Si es builtin, preserva `is_builtin = true`.
- `toggle_snippet_enabled(id: String, enabled: bool)`: Comando rápido y ligero para conmutar el estado sin recargar o validar todo el objeto.
- `delete_snippet(id: String)`: Si el snippet tiene `is_builtin = true`, no se borra físicamente de la base de datos; en su lugar, se conmuta a `is_enabled = false` (o se devuelve un aviso amigable y se desactiva), protegiendo la integridad de la base.

---

## 4. Frontend y Experiencia de Usuario (`SnippetDrawer.vue`)

- **Pestañas de Origen en la cabecera**:
  - `Todos` (contador total activos)
  - `Comunidad` (solo `is_builtin`)
  - `Mis Snippets` (solo `!is_builtin`)
- **Filtro / Checkbox**: *"Mostrar deshabilitados"* (por defecto desactivado).
- **Tarjetas de Snippet**:
  - Badge `Comunidad` en color cian/púrpura sutil.
  - Switch/Toggle para activar o desactivar al instante.
  - Botón de clonar/duplicar para crear una copia personal editable.
