use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

use crate::vault::db::{VaultError, VaultManager};

/// Imported color theme persisted with the settings. `theme` holds an xterm.js
/// ITheme and `ui` an optional UI palette; both are opaque to the backend.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct CustomTheme {
    pub id: String,
    pub name: String,
    pub theme: serde_json::Value,
    #[serde(default)]
    pub ui: Option<serde_json::Value>,
}

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
    #[serde(default)]
    pub custom_themes: Vec<CustomTheme>,
    #[serde(default = "default_appearance_mode")]
    pub appearance_mode: String, // "manual" | "system"
    #[serde(default = "default_theme_light_id")]
    pub theme_light_id: String,
    #[serde(default = "default_theme_dark_id")]
    pub theme_dark_id: String,
    #[serde(default = "default_ui_density")]
    pub ui_density: String, // "comfortable" | "compact"

    // Shell & Behavior
    #[serde(default)]
    pub default_shell: Option<String>,
    /// Inyecta marcas OSC 133 en terminales locales (bash/zsh/fish) para historial y bloques.
    #[serde(default = "default_true")]
    pub shell_integration: bool,
    /// Muestra en gris la continuación del comando que se está escribiendo (historial y snippets).
    #[serde(default = "default_true")]
    pub inline_suggestion: bool,
    #[serde(default = "default_close_to_tray")]
    pub close_to_tray: bool,

    // Security
    /// Pide la contraseña maestra al iniciar (si es false, arranca con terminal local y desbloqueo bajo demanda).
    #[serde(default)]
    pub ask_password_on_startup: bool,
    #[serde(default = "default_true")]
    pub auto_lock_enabled: bool,
    #[serde(default = "default_auto_lock")]
    pub auto_lock_minutes: u32,

    // SFTP Transfers
    #[serde(default = "default_sftp_max_concurrent_transfers")]
    pub sftp_max_concurrent_transfers: u32,

    // Terminal productivity
    #[serde(default = "default_true")]
    pub paste_warning: bool,
    #[serde(default = "default_paste_history_size")]
    pub paste_history_size: u32,
    #[serde(default = "default_true")]
    pub notify_long_commands: bool,
    #[serde(default = "default_notify_threshold_seconds")]
    pub notify_threshold_seconds: u32,
    #[serde(default)]
    pub notify_include_command: bool,

    // Advanced terminal productivity
    #[serde(default = "default_true")]
    pub history_enabled: bool,
    #[serde(default = "default_true")]
    pub instant_replay: bool,
    #[serde(default = "default_restore_sessions")]
    pub restore_sessions: String, // "ask" | "auto" | "off"
    #[serde(default = "default_true")]
    pub osc52_clipboard: bool,
    #[serde(default = "default_true")]
    pub inline_images: bool,
    #[serde(default)]
    pub font_ligatures: bool,

    // Remote Desktop (RDP / VNC)
    #[serde(default = "default_remote_desktop_clipboard")]
    pub remote_desktop_clipboard: bool,
}

fn default_remote_desktop_clipboard() -> bool {
    true
}

fn default_restore_sessions() -> String {
    "ask".to_string()
}

fn default_true() -> bool {
    true
}

fn default_paste_history_size() -> u32 {
    20
}

fn default_notify_threshold_seconds() -> u32 {
    10
}

impl AppSettings {
    /// Acota los valores numéricos a rangos válidos (se aplica siempre antes de guardar).
    pub fn sanitized(mut self) -> Self {
        // 0 era el antiguo valor "desactivado" (sin interfaz); ahora se activa con `auto_lock_enabled`.
        self.auto_lock_minutes = match self.auto_lock_minutes {
            0 => default_auto_lock(),
            m => m.min(MAX_AUTO_LOCK_MINUTES),
        };
        self.paste_history_size = self.paste_history_size.min(100);
        self.notify_threshold_seconds = self.notify_threshold_seconds.clamp(1, 3600);
        if !matches!(self.restore_sessions.as_str(), "ask" | "auto" | "off") {
            self.restore_sessions = default_restore_sessions();
        }
        self
    }
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
    "nexus-slate".to_string()
}

fn default_appearance_mode() -> String {
    "manual".to_string()
}

fn default_theme_light_id() -> String {
    "nexus-paper".to_string()
}

fn default_theme_dark_id() -> String {
    "nexus-slate".to_string()
}

fn default_ui_density() -> String {
    "comfortable".to_string()
}

fn default_auto_lock() -> u32 {
    10
}

const MAX_AUTO_LOCK_MINUTES: u32 = 1440;

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
            custom_themes: Vec::new(),
            appearance_mode: default_appearance_mode(),
            theme_light_id: default_theme_light_id(),
            theme_dark_id: default_theme_dark_id(),
            ui_density: default_ui_density(),
            default_shell: None,
            shell_integration: default_true(),
            inline_suggestion: default_true(),
            close_to_tray: default_close_to_tray(),
            ask_password_on_startup: false,
            auto_lock_enabled: true,
            auto_lock_minutes: default_auto_lock(),
            sftp_max_concurrent_transfers: default_sftp_max_concurrent_transfers(),
            remote_desktop_clipboard: default_remote_desktop_clipboard(),
            paste_warning: default_true(),
            paste_history_size: default_paste_history_size(),
            notify_long_commands: default_true(),
            notify_threshold_seconds: default_notify_threshold_seconds(),
            notify_include_command: false,
            history_enabled: default_true(),
            instant_replay: default_true(),
            restore_sessions: default_restore_sessions(),
            osc52_clipboard: default_true(),
            inline_images: default_true(),
            font_ligatures: false,
        }
    }
}

/// Native tray menu texts for the saved UI language (Spanish or English; anything else falls back to English).
pub struct TrayLabels {
    pub show: &'static str,
    pub quit: &'static str,
    pub tooltip: &'static str,
}

pub fn tray_labels(locale: &str) -> TrayLabels {
    if locale.eq_ignore_ascii_case("es") || locale.to_ascii_lowercase().starts_with("es-") {
        TrayLabels { show: "Mostrar NexusTerm", quit: "Salir", tooltip: "NexusTerm - Gestor SSH y Terminal" }
    } else {
        TrayLabels { show: "Show NexusTerm", quit: "Quit", tooltip: "NexusTerm - SSH Manager and Terminal" }
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
            Ok(settings.sanitized())
        }
        None => Ok(AppSettings::default()),
    }
}

pub fn save_settings_internal(
    conn: &Connection,
    settings: &AppSettings,
) -> Result<AppSettings, VaultError> {
    let settings = &settings.clone().sanitized();
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
    fn test_tray_labels_follow_locale() {
        assert_eq!(tray_labels("es").quit, "Salir");
        assert_eq!(tray_labels("es-MX").show, "Mostrar NexusTerm");
        assert_eq!(tray_labels("en").quit, "Quit");
        assert_eq!(tray_labels("fr").show, "Show NexusTerm");
    }

    #[test]
    fn test_default_settings_and_persistence() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();

        // Initially returns default
        let initial = get_settings_internal(&conn).unwrap();
        assert_eq!(initial.locale, "en");
        assert_eq!(initial.theme_id, "nexus-slate");
        assert!(initial.custom_themes.is_empty());
        assert_eq!(initial.appearance_mode, "manual");
        assert_eq!(initial.ui_density, "comfortable");
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
    fn test_custom_themes_persist_and_legacy_json_loads_without_them() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();
        conn.execute(
            "INSERT INTO app_settings (id, settings_json, updated_at) VALUES (1, '{\"theme_id\":\"dracula\"}', 'now')",
            [],
        )
        .unwrap();
        let legacy = get_settings_internal(&conn).unwrap();
        assert_eq!(legacy.theme_id, "dracula");
        assert!(legacy.custom_themes.is_empty());
        assert!(legacy.shell_integration);
        assert!(legacy.inline_suggestion);
        assert_eq!(legacy.theme_light_id, "nexus-paper");

        let mut s = legacy.clone();
        s.theme_id = "custom-1".to_string();
        s.appearance_mode = "system".to_string();
        s.custom_themes.push(CustomTheme {
            id: "custom-1".to_string(),
            name: "Mine".to_string(),
            theme: serde_json::json!({"background": "#000000", "foreground": "#ffffff"}),
            ui: None,
        });
        save_settings_internal(&conn, &s).unwrap();
        let fetched = get_settings_internal(&conn).unwrap();
        assert_eq!(fetched.custom_themes.len(), 1);
        assert_eq!(fetched.custom_themes[0].name, "Mine");
        assert_eq!(fetched.appearance_mode, "system");
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

    #[test]
    fn test_productivity_defaults_for_legacy_json() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();
        conn.execute(
            "INSERT INTO app_settings (id, settings_json, updated_at) VALUES (1, '{\"locale\":\"en\"}', 'now')",
            [],
        )
        .unwrap();
        let s = get_settings_internal(&conn).unwrap();
        assert!(s.paste_warning);
        assert_eq!(s.paste_history_size, 20);
        assert!(s.notify_long_commands);
        assert_eq!(s.notify_threshold_seconds, 10);
        assert!(!s.notify_include_command);
    }

    #[test]
    fn test_productivity_values_are_clamped_on_save_and_load() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();
        let mut s = AppSettings::default();
        s.notify_threshold_seconds = 0;
        s.paste_history_size = 5000;
        let saved = save_settings_internal(&conn, &s).unwrap();
        assert_eq!(saved.notify_threshold_seconds, 1);
        assert_eq!(saved.paste_history_size, 100);

        s.notify_threshold_seconds = 99_999;
        let saved = save_settings_internal(&conn, &s).unwrap();
        assert_eq!(saved.notify_threshold_seconds, 3600);
        assert_eq!(get_settings_internal(&conn).unwrap().notify_threshold_seconds, 3600);
    }

    #[test]
    fn test_advanced_defaults_for_legacy_json() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();
        conn.execute(
            "INSERT INTO app_settings (id, settings_json, updated_at) VALUES (1, '{\"locale\":\"en\"}', 'now')",
            [],
        )
        .unwrap();
        let s = get_settings_internal(&conn).unwrap();
        assert!(s.history_enabled);
        assert!(s.instant_replay);
        assert_eq!(s.restore_sessions, "ask");
        assert!(s.osc52_clipboard);
        assert!(s.inline_images);
        assert!(!s.font_ligatures);
    }

    #[test]
    fn test_invalid_restore_mode_falls_back_to_ask() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();
        let mut s = AppSettings {
            restore_sessions: "bogus".to_string(),
            ..AppSettings::default()
        };
        assert_eq!(save_settings_internal(&conn, &s).unwrap().restore_sessions, "ask");
        s.restore_sessions = "auto".to_string();
        assert_eq!(save_settings_internal(&conn, &s).unwrap().restore_sessions, "auto");
        conn.execute(
            "UPDATE app_settings SET settings_json = '{\"restore_sessions\":\"nope\"}' WHERE id = 1",
            [],
        )
        .unwrap();
        assert_eq!(get_settings_internal(&conn).unwrap().restore_sessions, "ask");
    }

    #[test]
    fn test_lock_settings_defaults() {
        let d = AppSettings::default();
        assert!(!d.ask_password_on_startup);
        assert!(d.auto_lock_enabled);
        assert_eq!(d.auto_lock_minutes, 10);
    }

    #[test]
    fn test_legacy_json_without_lock_fields_gets_new_defaults() {
        // JSON guardado antes de este cambio: `auto_lock_minutes: 0` y sin los campos nuevos.
        let legacy: AppSettings =
            serde_json::from_str(r#"{"locale":"es","auto_lock_minutes":0}"#).unwrap();
        let s = legacy.sanitized();
        assert_eq!(s.locale, "es");
        assert!(!s.ask_password_on_startup);
        assert!(s.auto_lock_enabled);
        assert_eq!(s.auto_lock_minutes, 10);
    }

    #[test]
    fn test_auto_lock_minutes_validation() {
        let mut s = AppSettings::default();
        s.auto_lock_minutes = 0;
        assert_eq!(s.clone().sanitized().auto_lock_minutes, 10);
        s.auto_lock_minutes = 1;
        assert_eq!(s.clone().sanitized().auto_lock_minutes, 1);
        s.auto_lock_minutes = 5000;
        assert_eq!(s.sanitized().auto_lock_minutes, 1440);
    }

    #[test]
    fn test_lock_settings_persist() {
        let conn = Connection::open_in_memory().unwrap();
        VaultManager::run_migrations(&conn).unwrap();
        let mut s = AppSettings::default();
        s.ask_password_on_startup = true;
        s.auto_lock_enabled = false;
        s.auto_lock_minutes = 30;
        save_settings_internal(&conn, &s).unwrap();
        assert_eq!(get_settings_internal(&conn).unwrap(), s);
    }
}
