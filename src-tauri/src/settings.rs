use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

use crate::vault::db::{VaultError, VaultManager};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct AppSettings {
    // General & i18n
    #[serde(default = "default_locale")]
    pub locale: String,

    // Terminal Appearance
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_font_size")]
    pub font_size: u32,
    #[serde(default = "default_line_height")]
    pub line_height: f32,
    #[serde(default = "default_cursor_style")]
    pub cursor_style: String, // "block" | "bar" | "underline"
    #[serde(default = "default_cursor_blink")]
    pub cursor_blink: bool,
    #[serde(default = "default_theme_id")]
    pub theme_id: String,

    // Shell & Behavior
    #[serde(default)]
    pub default_shell: Option<String>,
    #[serde(default = "default_close_to_tray")]
    pub close_to_tray: bool,

    // Security
    #[serde(default = "default_auto_lock")]
    pub auto_lock_minutes: u32,

    // SFTP Transfers
    #[serde(default = "default_sftp_max_concurrent_transfers")]
    pub sftp_max_concurrent_transfers: u32,

    // Remote Desktop (RDP / VNC)
    #[serde(default = "default_remote_desktop_clipboard")]
    pub remote_desktop_clipboard: bool,
}

fn default_remote_desktop_clipboard() -> bool {
    true
}

fn default_sftp_max_concurrent_transfers() -> u32 {
    2
}

fn default_close_to_tray() -> bool {
    true
}

fn default_locale() -> String {
    "en".to_string()
}

fn default_font_family() -> String {
    "'MesloLGS NF', 'Hack Nerd Font Mono', 'Hack Nerd Font', 'FiraCode Nerd Font', 'JetBrainsMono Nerd Font', monospace".to_string()
}

fn default_font_size() -> u32 {
    13
}

fn default_line_height() -> f32 {
    1.2
}

fn default_cursor_style() -> String {
    "block".to_string()
}

fn default_cursor_blink() -> bool {
    true
}

fn default_theme_id() -> String {
    "tokyo-night".to_string()
}

fn default_auto_lock() -> u32 {
    0 // disabled
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            locale: default_locale(),
            font_family: default_font_family(),
            font_size: default_font_size(),
            line_height: default_line_height(),
            cursor_style: default_cursor_style(),
            cursor_blink: default_cursor_blink(),
            theme_id: default_theme_id(),
            default_shell: None,
            close_to_tray: default_close_to_tray(),
            auto_lock_minutes: default_auto_lock(),
            sftp_max_concurrent_transfers: default_sftp_max_concurrent_transfers(),
            remote_desktop_clipboard: default_remote_desktop_clipboard(),
        }
    }
}

pub fn get_settings_internal(conn: &Connection) -> Result<AppSettings, VaultError> {
    let row: Option<String> = conn
        .query_row(
            "SELECT settings_json FROM app_settings WHERE id = 1",
            [],
            |r| r.get(0),
        )
        .optional()?;

    match row {
        Some(json_str) => {
            let settings: AppSettings = serde_json::from_str(&json_str).unwrap_or_default();
            Ok(settings)
        }
        None => Ok(AppSettings::default()),
    }
}

pub fn save_settings_internal(
    conn: &Connection,
    settings: &AppSettings,
) -> Result<AppSettings, VaultError> {
    let json_str = serde_json::to_string(settings)
        .map_err(|e| VaultError::DbError(rusqlite::Error::ToSqlConversionFailure(Box::new(e))))?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO app_settings (id, settings_json, updated_at)
         VALUES (1, ?1, ?2)
         ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at",
        params![json_str, now],
    )?;

    Ok(settings.clone())
}

#[tauri::command]
pub fn get_app_settings(
    vault_mgr: State<'_, Arc<VaultManager>>,
) -> Result<AppSettings, VaultError> {
    let conn = vault_mgr.db.lock().unwrap();
    get_settings_internal(&conn)
}

#[tauri::command]
pub fn save_app_settings(
    settings: AppSettings,
    vault_mgr: State<'_, Arc<VaultManager>>,
) -> Result<AppSettings, VaultError> {
    let conn = vault_mgr.db.lock().unwrap();
    save_settings_internal(&conn, &settings)
}

#[tauri::command]
pub fn reset_app_settings(
    vault_mgr: State<'_, Arc<VaultManager>>,
) -> Result<AppSettings, VaultError> {
    let default = AppSettings::default();
    let conn = vault_mgr.db.lock().unwrap();
    save_settings_internal(&conn, &default)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings_and_persistence() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();

        // Initially returns default
        let initial = get_settings_internal(&conn).unwrap();
        assert_eq!(initial.locale, "en");
        assert_eq!(initial.theme_id, "tokyo-night");
        assert_eq!(initial.font_size, 13);
        assert_eq!(initial.cursor_style, "block");
        assert_eq!(initial.close_to_tray, true);
        assert_eq!(initial.sftp_max_concurrent_transfers, 2);
        assert!(initial.remote_desktop_clipboard);

        // Save customized settings
        let mut customized = initial.clone();
        customized.locale = "es".to_string();
        customized.theme_id = "dracula".to_string();
        customized.font_size = 15;
        customized.cursor_style = "underline".to_string();
        customized.default_shell = Some("/bin/zsh".to_string());
        customized.sftp_max_concurrent_transfers = 4;

        let saved = save_settings_internal(&conn, &customized).unwrap();
        assert_eq!(saved, customized);

        // Fetch again and verify persistence
        let fetched = get_settings_internal(&conn).unwrap();
        assert_eq!(fetched, customized);
        assert_eq!(fetched.sftp_max_concurrent_transfers, 4);
    }

    #[test]
    fn test_legacy_settings_json_defaults_remote_clipboard_to_enabled() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();
        conn.execute(
            "INSERT INTO app_settings (id, settings_json, updated_at) VALUES (1, '{\"locale\":\"es\"}', 'now')",
            [],
        )
        .unwrap();
        let s = get_settings_internal(&conn).unwrap();
        assert_eq!(s.locale, "es");
        assert!(s.remote_desktop_clipboard);
    }
}
