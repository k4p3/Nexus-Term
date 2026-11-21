pub mod pty;
pub mod remote_desktop;
pub mod session;
pub mod settings;
pub mod sftp;
pub mod snippets;
pub mod ssh;
pub mod ssh_config;
pub mod telemetry;
pub mod tunnels;
pub mod vault;

use std::fs;
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};
use rusqlite::Connection;
use crate::pty::{open_local_pty, PtySessionManager};
use crate::remote_desktop::manager::{
    rd_accept_cert, rd_connect, rd_disconnect, rd_resize, rd_send_cad, rd_send_input, rd_set_clipboard,
    RemoteDesktopManager,
};
use crate::session::{close_session, extract_public_key, generate_ssh_key, resize_session, write_session};
use crate::settings::{get_app_settings, reset_app_settings, save_app_settings};
use crate::sftp::commands::{
    sftp_connect, sftp_disconnect, sftp_download, sftp_get_download_directory, sftp_list_dir,
    sftp_mkdir, sftp_pick_download_directory, sftp_pick_upload_files, sftp_remove, sftp_rename,
    sftp_resolve_home, sftp_upload,
};
use crate::sftp::SftpSessionManager;
use crate::snippets::{delete_snippet, get_snippets, save_snippet, toggle_snippet_enabled};
use crate::ssh::{connect_ssh, SshSessionManager};
use crate::ssh_config::{detect_ssh_config, import_ssh_config};
use crate::telemetry::commands::{fetch_telemetry_snapshot, start_telemetry_stream, stop_telemetry_stream};
use crate::telemetry::TelemetryManager;
use crate::tunnels::commands::{
    delete_tunnel, get_tunnel_statuses, list_tunnels, save_tunnel, start_tunnel, stop_tunnel,
};
use crate::tunnels::manager::SshTunnelManager;
use crate::vault::db::{
    VaultManager, vault_change_password, vault_init, vault_lock, vault_status, vault_unlock,
};
use crate::vault::history::{
    history_clear, history_delete, history_record, history_search, session_layout_clear,
    session_layout_get, session_layout_save,
};
use crate::vault::inventory::{
    delete_folder, delete_host, delete_identity, get_inventory, save_folder, save_host,
    save_identity,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second launch (e.g. app menu icon while hidden in tray) restores the existing window.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
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
            // Tray labels follow the saved UI language (read before the connection moves into the vault).
            let tray_locale = crate::settings::get_settings_internal(&conn)
                .map(|s| s.locale)
                .unwrap_or_else(|_| "en".to_string());
            let tray = crate::settings::tray_labels(&tray_locale);
            let vault_mgr = Arc::new(VaultManager::new(conn).expect("Failed to initialize vault schema migrations"));
            
            app.manage(vault_mgr.clone());
            app.manage(PtySessionManager::new());
            app.manage(SshSessionManager::new());
            app.manage(Arc::new(SshTunnelManager::new()));
            app.manage(Arc::new(SftpSessionManager::new()));
            app.manage(Arc::new(TelemetryManager::new()));
            app.manage(Arc::new(RemoteDesktopManager::new()));

            // Explicitly set the main window icon for Linux/Wayland/X11 window managers
            if let Some(window) = app.get_webview_window("main") {
                let window_icon = tauri::include_image!("icons/128x128.png");
                let _ = window.set_icon(window_icon);
            }

            // Build Native System Tray (StatusNotifierItem on KDE / Linux)
            let show_item = MenuItem::with_id(app, "show", tray.show, true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", tray.quit, true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .tooltip(tray.tooltip)
                .show_menu_on_left_click(false)
                .icon_as_template(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                });

            let tray_img = tauri::include_image!("icons/tray-64x64.png");
            tray_builder = tray_builder.icon(tray_img);

            let _tray = tray_builder.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let should_close_to_tray = if let Some(vault_mgr) = app.try_state::<Arc<VaultManager>>() {
                    if let Ok(conn) = vault_mgr.db.lock() {
                        crate::settings::get_settings_internal(&conn)
                            .map(|s| s.close_to_tray)
                            .unwrap_or(true)
                    } else {
                        true
                    }
                } else {
                    true
                };

                if should_close_to_tray {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
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
            history_record,
            history_search,
            history_delete,
            history_clear,
            session_layout_save,
            session_layout_get,
            session_layout_clear,
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
            toggle_snippet_enabled,
            delete_snippet,
            detect_ssh_config,
            import_ssh_config,
            list_tunnels,
            save_tunnel,
            delete_tunnel,
            start_tunnel,
            stop_tunnel,
            get_tunnel_statuses,
            sftp_connect,
            sftp_resolve_home,
            sftp_list_dir,
            sftp_mkdir,
            sftp_rename,
            sftp_remove,
            sftp_download,
            sftp_upload,
            sftp_disconnect,
            sftp_pick_upload_files,
            sftp_get_download_directory,
            sftp_pick_download_directory,
            fetch_telemetry_snapshot,
            start_telemetry_stream,
            stop_telemetry_stream,
            rd_connect,
            rd_send_input,
            rd_resize,
            rd_send_cad,
            rd_set_clipboard,
            rd_accept_cert,
            rd_disconnect,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
