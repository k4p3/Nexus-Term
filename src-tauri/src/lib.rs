pub mod pty;
pub mod session;
pub mod settings;
pub mod snippets;
pub mod ssh;
pub mod vault;

use std::fs;
use std::sync::Arc;
use tauri::Manager;
use rusqlite::Connection;
use crate::pty::{open_local_pty, PtySessionManager};
use crate::session::{close_session, extract_public_key, generate_ssh_key, resize_session, write_session};
use crate::settings::{get_app_settings, reset_app_settings, save_app_settings};
use crate::snippets::{delete_snippet, get_snippets, save_snippet};
use crate::ssh::{connect_ssh, SshSessionManager};
use crate::vault::db::{
    VaultManager, vault_change_password, vault_init, vault_lock, vault_status, vault_unlock,
};
use crate::vault::inventory::{
    delete_folder, delete_host, delete_identity, get_inventory, save_folder, save_host,
    save_identity,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(icon) = app.default_window_icon() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_icon(icon.clone());
                }
            }

            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("./"));
            
            fs::create_dir_all(&app_data_dir).ok();
            let db_path = app_data_dir.join("vault.db");
            let conn = Connection::open(db_path).expect("Failed to open vault.db SQLite database");
            let vault_mgr = Arc::new(VaultManager::new(conn).expect("Failed to initialize vault schema migrations"));
            
            app.manage(vault_mgr.clone());
            app.manage(PtySessionManager::new());
            app.manage(SshSessionManager::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            vault_status,
            vault_init,
            vault_unlock,
            vault_lock,
            vault_change_password,
            get_inventory,
            save_folder,
            delete_folder,
            save_identity,
            delete_identity,
            save_host,
            delete_host,
            open_local_pty,
            connect_ssh,
            generate_ssh_key,
            extract_public_key,
            write_session,
            resize_session,
            close_session,
            get_app_settings,
            save_app_settings,
            reset_app_settings,
            get_snippets,
            save_snippet,
            delete_snippet,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
