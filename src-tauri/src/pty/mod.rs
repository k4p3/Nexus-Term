use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::ipc::Channel;
use uuid::Uuid;

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
