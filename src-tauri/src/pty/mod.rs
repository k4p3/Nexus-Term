use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::ipc::Channel;
use uuid::Uuid;

/// Variables que el runtime de AppImage / linuxdeploy inyecta para que la app
/// use sus librerías empaquetadas. Si las hereda el shell hijo, los programas
/// del sistema (node, libaccountsservice...) cargan glib/nghttp2 incompatibles.
const APPIMAGE_ONLY_VARS: &[&str] = &[
    "LD_LIBRARY_PATH",
    "LD_PRELOAD",
    "APPDIR",
    "APPIMAGE",
    "ARGV0",
    "OWD",
    "GTK_PATH",
    "GTK_EXEC_PREFIX",
    "GTK_DATA_PREFIX",
    "GTK_IM_MODULE_FILE",
    "GDK_PIXBUF_MODULE_FILE",
    "GDK_PIXBUF_MODULEDIR",
    "GIO_EXTRA_MODULES",
    "GSETTINGS_SCHEMA_DIR",
    "PERLLIB",
    "PYTHONHOME",
];

/// Variables de lista de rutas de las que solo se descartan las entradas bajo `APPDIR`.
const APPIMAGE_PATH_LIST_VARS: &[&str] = &["PATH", "XDG_DATA_DIRS", "XDG_CONFIG_DIRS"];

/// Calcula qué variables quitar y cuáles reescribir para un hijo lanzado desde un AppImage.
/// Devuelve `None` si el proceso no corre dentro de un AppImage.
fn appimage_env_fixes(
    env: &[(String, String)],
) -> Option<(Vec<String>, Vec<(String, String)>)> {
    let get = |k: &str| env.iter().find(|(n, _)| n == k).map(|(_, v)| v.as_str());
    if get("APPIMAGE").is_none() && get("APPDIR").is_none() {
        return None;
    }
    let appdir = get("APPDIR").map(|s| s.trim_end_matches('/').to_string());

    let remove = APPIMAGE_ONLY_VARS.iter().map(|s| s.to_string()).collect();
    let mut set = Vec::new();
    if let Some(dir) = appdir.filter(|d| !d.is_empty()) {
        for var in APPIMAGE_PATH_LIST_VARS {
            if let Some(value) = get(var) {
                let cleaned: Vec<&str> = value
                    .split(':')
                    .filter(|p| !p.is_empty() && *p != dir && !p.starts_with(&format!("{}/", dir)))
                    .collect();
                set.push((var.to_string(), cleaned.join(":")));
            }
        }
    }
    Some((remove, set))
}

fn apply_appimage_sanitization(cmd: &mut CommandBuilder) {
    let env: Vec<(String, String)> = std::env::vars().collect();
    if let Some((remove, set)) = appimage_env_fixes(&env) {
        for key in remove {
            cmd.env_remove(key);
        }
        for (key, value) in set {
            cmd.env(key, value);
        }
    }
}

pub struct LocalSession {
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    pub child_killer: Arc<Mutex<Box<dyn portable_pty::ChildKiller + Send + Sync>>>,
}

#[derive(Default)]
pub struct PtySessionManager {
    sessions: Arc<Mutex<HashMap<String, LocalSession>>>,
}

impl PtySessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn spawn_local(
        &self,
        cols: u16,
        rows: u16,
        custom_shell: Option<String>,
        on_data: Channel<Vec<u8>>,
    ) -> Result<String, String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        // Determine default shell
        let shell = custom_shell
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| {
                std::env::var("SHELL").unwrap_or_else(|_| {
                    if cfg!(windows) {
                        "powershell.exe".to_string()
                    } else {
                        "/bin/bash".to_string()
                    }
                })
            });

        let mut cmd = CommandBuilder::new(&shell);
        if cfg!(unix) {
            cmd.arg("-l");
        }
        if let Ok(home) = std::env::var("HOME") {
            cmd.cwd(home);
        }
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        apply_appimage_sanitization(&mut cmd);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell '{}': {}", shell, e))?;

        let child_killer = Arc::new(Mutex::new(child.clone_killer()));
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;
        let writer = Arc::new(Mutex::new(
            pair.master
                .take_writer()
                .map_err(|e| format!("Failed to take PTY writer: {}", e))?,
        ));
        let master = Arc::new(Mutex::new(pair.master));

        let session_id = Uuid::now_v7().to_string();

        // Spawn background reader thread streaming chunks over the Tauri IPC Channel
        let sess_id_clone = session_id.clone();
        let sessions_clone = self.sessions.clone();

        thread::Builder::new()
            .name(format!("pty-reader-{}", session_id))
            .spawn(move || {
                let mut buffer = [0u8; 8192];
                loop {
                    match reader.read(&mut buffer) {
                        Ok(0) => break, // EOF, child process exited
                        Ok(n) => {
                            if on_data.send(buffer[..n].to_vec()).is_err() {
                                break; // Frontend channel closed
                            }
                        }
                        Err(_) => break,
                    }
                }
                // Cleanup session when process exits
                sessions_clone.lock().unwrap().remove(&sess_id_clone);
            })
            .map_err(|e| format!("Failed to spawn reader thread: {}", e))?;

        let session = LocalSession {
            writer,
            master,
            child_killer,
        };

        self.sessions
            .lock()
            .unwrap()
            .insert(session_id.clone(), session);

        Ok(session_id)
    }

    pub fn has_session(&self, session_id: &str) -> bool {
        self.sessions.lock().unwrap().contains_key(session_id)
    }

    pub fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let guard = self.sessions.lock().unwrap();
        if let Some(session) = guard.get(session_id) {
            let mut writer = session.writer.lock().unwrap();
            writer
                .write_all(data)
                .map_err(|e| format!("Failed to write to session: {}", e))?;
            writer.flush().map_err(|e| format!("Failed to flush: {}", e))?;
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let guard = self.sessions.lock().unwrap();
        if let Some(session) = guard.get(session_id) {
            let master = session.master.lock().unwrap();
            master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Failed to resize PTY: {}", e))?;
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    }

    pub fn close(&self, session_id: &str) -> Result<(), String> {
        let mut guard = self.sessions.lock().unwrap();
        if let Some(session) = guard.remove(session_id) {
            let mut killer = session.child_killer.lock().unwrap();
            killer.kill().ok();
        }
        Ok(())
    }
}

// Tauri Commands for Local PTY
#[tauri::command]
pub fn open_local_pty(
    manager: tauri::State<'_, PtySessionManager>,
    cols: u16,
    rows: u16,
    custom_shell: Option<String>,
    on_data: Channel<Vec<u8>>,
) -> Result<String, String> {
    manager.spawn_local(cols, rows, custom_shell, on_data)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn no_changes_outside_appimage() {
        let e = env(&[("PATH", "/usr/bin"), ("LD_LIBRARY_PATH", "/opt/lib")]);
        assert!(appimage_env_fixes(&e).is_none());
    }

    #[test]
    fn removes_appimage_vars_and_cleans_path_lists() {
        let e = env(&[
            ("APPIMAGE", "/home/u/app.AppImage"),
            ("APPDIR", "/tmp/.mount_abc"),
            ("LD_LIBRARY_PATH", "/tmp/.mount_abc/usr/lib"),
            ("PATH", "/tmp/.mount_abc/usr/bin:/usr/bin:/bin"),
            ("XDG_DATA_DIRS", "/tmp/.mount_abc/usr/share:/usr/share"),
        ]);
        let (remove, set) = appimage_env_fixes(&e).expect("appimage detected");
        assert!(remove.contains(&"LD_LIBRARY_PATH".to_string()));
        assert!(remove.contains(&"APPDIR".to_string()));
        assert!(set.contains(&("PATH".to_string(), "/usr/bin:/bin".to_string())));
        assert!(set.contains(&("XDG_DATA_DIRS".to_string(), "/usr/share".to_string())));
    }

    #[test]
    fn does_not_strip_similarly_named_dirs() {
        let e = env(&[
            ("APPDIR", "/tmp/.mount_abc"),
            ("PATH", "/tmp/.mount_abcdef/bin:/usr/bin"),
        ]);
        let (_, set) = appimage_env_fixes(&e).expect("appimage detected");
        assert!(set.contains(&("PATH".to_string(), "/tmp/.mount_abcdef/bin:/usr/bin".to_string())));
    }
}
