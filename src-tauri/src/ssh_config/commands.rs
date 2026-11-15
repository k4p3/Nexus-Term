use chrono::Utc;
use rusqlite::params;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use uuid::Uuid;

use super::known_hosts::parse_known_hosts;
use super::models::{
    ImportSshConfigPayload, ImportSummary, SshConfigPreview,
};
use super::parser::parse_ssh_config;
use crate::vault::db::VaultManager;
use crate::vault::inventory::{Folder, SaveHostPayload, SaveIdentityPayload};

pub fn get_ssh_dir() -> Option<PathBuf> {
    if let Ok(home) = std::env::var("HOME") {
        Some(PathBuf::from(home).join(".ssh"))
    } else if let Ok(profile) = std::env::var("USERPROFILE") {
        Some(PathBuf::from(profile).join(".ssh"))
    } else {
        None
    }
}

pub fn expand_tilde(path_str: &str) -> PathBuf {
    if path_str.starts_with("~/") || path_str == "~" {
        if let Some(ssh_dir) = get_ssh_dir() {
            if let Some(home) = ssh_dir.parent() {
                if path_str == "~" {
                    return home.to_path_buf();
                } else {
                    return home.join(&path_str[2..]);
                }
            }
        }
    }
    PathBuf::from(path_str)
}

#[tauri::command]
pub fn detect_ssh_config(
    vault_mgr: tauri::State<'_, Arc<VaultManager>>,
) -> Result<SshConfigPreview, String> {
    let ssh_dir = get_ssh_dir().unwrap_or_else(|| PathBuf::from("./"));
    let config_path = ssh_dir.join("config");
    let known_hosts_path = ssh_dir.join("known_hosts");

    let config_found = config_path.exists();
    let known_hosts_found = known_hosts_path.exists();

    let mut hosts = if config_found {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read SSH config file: {}", e))?;
        parse_ssh_config(&content)
    } else {
        Vec::new()
    };

    let known_hosts_count = if known_hosts_found {
        let content = fs::read_to_string(&known_hosts_path).unwrap_or_default();
        parse_known_hosts(&content).len()
    } else {
        0
    };

    // Check duplicates against inventory if vault is unlocked
    if let Ok(inv) = vault_mgr.get_inventory() {
        for entry in &mut hosts {
            let is_dup = inv.hosts.iter().any(|h| {
                (h.hostname.eq_ignore_ascii_case(&entry.hostname) && h.port == entry.port)
                    || h.label.eq_ignore_ascii_case(&entry.alias)
            });
            entry.is_duplicate = is_dup;
        }
    }

    Ok(SshConfigPreview {
        config_path: config_path.to_string_lossy().to_string(),
        known_hosts_path: known_hosts_path.to_string_lossy().to_string(),
        config_found,
        known_hosts_found,
        hosts,
        known_hosts_count,
    })
}

#[tauri::command]
pub fn import_ssh_config(
    vault_mgr: tauri::State<'_, Arc<VaultManager>>,
    payload: ImportSshConfigPayload,
) -> Result<ImportSummary, String> {
    let _vault_key = vault_mgr
        .get_active_vault_key()
        .map_err(|e| format!("Vault must be unlocked to import configurations: {}", e))?;

    let mut summary = ImportSummary::default();

    // 1. Resolve or create folder if requested
    let mut target_folder_id: Option<String> = None;
    if let Some(folder_name) = payload.folder_name.filter(|s| !s.trim().is_empty()) {
        let inv = vault_mgr.get_inventory().map_err(|e| e.to_string())?;
        if let Some(existing) = inv.folders.iter().find(|f| f.name.eq_ignore_ascii_case(folder_name.trim())) {
            target_folder_id = Some(existing.id.clone());
        } else {
            let new_folder_id = vault_mgr
                .save_folder(Folder {
                    id: String::new(),
                    parent_id: None,
                    name: folder_name.trim().to_string(),
                    icon: Some("folder-git".to_string()),
                    color: Some("#38bdf8".to_string()),
                    sort_order: 0,
                    updated_at: Utc::now().to_rfc3339(),
                })
                .map_err(|e| format!("Failed to create folder: {}", e))?;
            target_folder_id = Some(new_folder_id);
        }
        summary.folder_id = target_folder_id.clone();
    }

    // 2. Import hosts & identities
    for entry in payload.selected_hosts {
        if entry.is_duplicate && !payload.overwrite_duplicates {
            summary.hosts_skipped += 1;
            continue;
        }

        let mut identity_id: Option<String> = None;

        // Try importing IdentityFile if specified
        if let Some(id_file) = &entry.identity_file {
            let expanded = expand_tilde(id_file);
            if expanded.exists() {
                if let Ok(key_content) = fs::read_to_string(&expanded) {
                    let user_name = entry.user.clone().unwrap_or_else(|| "root".to_string());
                    let identity_name = format!("{} ({})", entry.alias, expanded.file_name().and_then(|n| n.to_str()).unwrap_or("id_key"));

                    let new_id = vault_mgr
                        .save_identity(SaveIdentityPayload {
                            id: None,
                            name: identity_name,
                            username: user_name,
                            auth_type: "private_key".to_string(),
                            public_key: None, // Automatically derived in save_identity
                            secret: Some(key_content),
                            passphrase: None,
                        })
                        .ok();

                    if let Some(id) = new_id {
                        identity_id = Some(id);
                        summary.identities_created += 1;
                    }
                }
            }
        }

        // Tags
        let mut tags = vec!["ssh-config".to_string()];
        if let Some(jump) = &entry.proxy_jump {
            tags.push(format!("jump:{}", jump));
        }

        let host_payload = SaveHostPayload {
            id: None,
            folder_id: target_folder_id.clone(),
            label: entry.alias,
            hostname: entry.hostname,
            port: entry.port,
            username_override: entry.user,
            identity_id,
            tags,
            notes: Some("Importado automáticamente desde ~/.ssh/config".to_string()),
        };

        vault_mgr
            .save_host(host_payload)
            .map_err(|e| format!("Failed to save host: {}", e))?;

        summary.hosts_imported += 1;
    }

    // 3. Import known_hosts if requested
    if payload.import_known_hosts {
        if let Some(ssh_dir) = get_ssh_dir() {
            let known_hosts_path = ssh_dir.join("known_hosts");
            if known_hosts_path.exists() {
                if let Ok(content) = fs::read_to_string(&known_hosts_path) {
                    let parsed_kh = parse_known_hosts(&content);
                    let now = Utc::now().to_rfc3339();
                    let conn = vault_mgr.db.lock().unwrap();

                    for item in parsed_kh {
                        let id = Uuid::now_v7().to_string();
                        let res = conn.execute(
                            "INSERT OR IGNORE INTO known_hosts (id, hostname, port, key_type, fingerprint_sha256, public_key_base64, trusted_at)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                            params![
                                id,
                                item.hostname,
                                item.port as u32,
                                item.key_type,
                                item.fingerprint_sha256,
                                item.public_key_base64,
                                now
                            ],
                        );
                        if let Ok(rows) = res {
                            if rows > 0 {
                                summary.known_hosts_imported += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(summary)
}
