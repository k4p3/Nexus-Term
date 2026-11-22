//! Inyección de integración de shell (OSC 133) en terminales locales, sin tocar los ficheros del usuario.
use std::fs;
use std::path::{Path, PathBuf};

const ZSH_ZSHENV: &str = include_str!("../../resources/shell-integration/zsh/.zshenv");
const ZSH_ZPROFILE: &str = include_str!("../../resources/shell-integration/zsh/.zprofile");
const ZSH_ZSHRC: &str = include_str!("../../resources/shell-integration/zsh/.zshrc");
const BASH_SH: &str = include_str!("../../resources/shell-integration/bash.sh");
const FISH_FISH: &str = include_str!("../../resources/shell-integration/fish.fish");

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShellKind {
    Bash,
    Zsh,
    Fish,
}

/// Argumentos y variables de entorno que sustituyen al arranque habitual del shell.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Plan {
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
}

/// Detecta el shell por el nombre del ejecutable (`/usr/bin/zsh`, `zsh`, `zsh5`…).
pub fn detect_shell(shell: &str) -> Option<ShellKind> {
    let name = Path::new(shell).file_name()?.to_str()?.to_lowercase();
    match name.as_str() {
        "bash" => Some(ShellKind::Bash),
        "zsh" => Some(ShellKind::Zsh),
        "fish" => Some(ShellKind::Fish),
        _ => None,
    }
}

/// Escribe los scripts embebidos en `dir/<versión>/` (0700 / 0600 en Unix) y devuelve esa ruta.
pub fn materialize(base: &Path) -> std::io::Result<PathBuf> {
    let dir = base.join("shell-integration").join(env!("CARGO_PKG_VERSION"));
    let files: [(&str, &str); 5] = [
        ("zsh/.zshenv", ZSH_ZSHENV),
        ("zsh/.zprofile", ZSH_ZPROFILE),
        ("zsh/.zshrc", ZSH_ZSHRC),
        ("bash.sh", BASH_SH),
        ("fish.fish", FISH_FISH),
    ];
    fs::create_dir_all(dir.join("zsh"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&dir, fs::Permissions::from_mode(0o700))?;
        fs::set_permissions(dir.join("zsh"), fs::Permissions::from_mode(0o700))?;
    }
    for (name, content) in files {
        let path = dir.join(name);
        if fs::read_to_string(&path).map(|c| c != content).unwrap_or(true) {
            fs::write(&path, content)?;
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o600))?;
        }
    }
    Ok(dir)
}

/// Plan de arranque con integración para `shell`, o `None` si el shell no está soportado.
/// `user_zdotdir` es el `ZDOTDIR` heredado del usuario (se restaura tras cargar su `.zshrc`).
pub fn integration_plan(shell: &str, dir: &Path, user_zdotdir: Option<&str>) -> Option<Plan> {
    let kind = detect_shell(shell)?;
    let flag = ("NEXUSTERM_SHELL_INTEGRATION".to_string(), "1".to_string());
    let s = |p: PathBuf| p.to_string_lossy().into_owned();
    Some(match kind {
        ShellKind::Zsh => Plan {
            args: vec!["-l".into()],
            env: vec![
                flag,
                ("ZDOTDIR".into(), s(dir.join("zsh"))),
                ("NEXUSTERM_USER_ZDOTDIR".into(), user_zdotdir.unwrap_or("").to_string()),
            ],
        },
        ShellKind::Bash => Plan {
            args: vec!["--init-file".into(), s(dir.join("bash.sh"))],
            env: vec![flag],
        },
        ShellKind::Fish => Plan {
            args: vec![
                "-l".into(),
                "--init-command".into(),
                format!("source '{}'", s(dir.join("fish.fish")).replace('\'', "\\'")),
            ],
            env: vec![flag],
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("nt-si-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn detects_supported_shells() {
        assert_eq!(detect_shell("/usr/bin/zsh"), Some(ShellKind::Zsh));
        assert_eq!(detect_shell("bash"), Some(ShellKind::Bash));
        assert_eq!(detect_shell("/usr/bin/fish"), Some(ShellKind::Fish));
        assert_eq!(detect_shell("/bin/sh"), None);
        assert_eq!(detect_shell("powershell.exe"), None);
        assert_eq!(detect_shell(""), None);
    }

    #[test]
    fn plan_per_shell() {
        let d = Path::new("/c/si");
        let z = integration_plan("/bin/zsh", d, Some("/home/u/.zsh")).unwrap();
        assert_eq!(z.args, vec!["-l"]);
        assert!(z.env.contains(&("ZDOTDIR".into(), "/c/si/zsh".into())));
        assert!(z.env.contains(&("NEXUSTERM_USER_ZDOTDIR".into(), "/home/u/.zsh".into())));
        let b = integration_plan("/bin/bash", d, None).unwrap();
        assert_eq!(b.args, vec!["--init-file", "/c/si/bash.sh"]);
        let f = integration_plan("fish", d, None).unwrap();
        assert!(f.args.contains(&"--init-command".to_string()));
        assert!(f.env.contains(&("NEXUSTERM_SHELL_INTEGRATION".into(), "1".into())));
        assert!(integration_plan("/bin/sh", d, None).is_none());
    }

    #[test]
    fn materialize_writes_scripts_with_private_perms() {
        let base = tmp("mat");
        let dir = materialize(&base).unwrap();
        let bash = fs::read_to_string(dir.join("bash.sh")).unwrap();
        assert!(bash.contains("133;A") && bash.contains("133;C") && bash.contains("133;D"));
        assert!(fs::read_to_string(dir.join("zsh/.zshrc")).unwrap().contains("NEXUSTERM_USER_ZDOTDIR"));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(fs::metadata(&dir).unwrap().permissions().mode() & 0o777, 0o700);
            assert_eq!(fs::metadata(dir.join("bash.sh")).unwrap().permissions().mode() & 0o777, 0o600);
        }
        materialize(&base).unwrap(); // idempotente
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn materialize_fails_on_unwritable_base() {
        let base = tmp("ro");
        let file = base.join("file");
        fs::write(&file, "x").unwrap();
        assert!(materialize(&file).is_err()); // un fichero no puede ser directorio base
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn real_bash_emits_osc133_marks() {
        if Command::new("bash").arg("--version").output().is_err() {
            return;
        }
        let base = tmp("bash");
        let dir = materialize(&base).unwrap();
        let home = tmp("home");
        let plan = integration_plan("bash", &dir, None).unwrap();
        let mut cmd = Command::new("bash");
        cmd.args(&plan.args).arg("-i").env("HOME", &home).env("PS1", "$ ");
        for (k, v) in &plan.env {
            cmd.env(k, v);
        }
        use std::io::Write;
        use std::process::Stdio;
        let mut child = cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
        child.stdin.take().unwrap().write_all(b"true\nexit\n").unwrap();
        let out = child.wait_with_output().unwrap();
        let text = String::from_utf8_lossy(&out.stderr).to_string() + &String::from_utf8_lossy(&out.stdout);
        assert!(text.contains("\x1b]133;A\x07"), "missing A: {text:?}");
        assert!(text.contains("\x1b]133;B\x07"), "missing B: {text:?}");
        let _ = fs::remove_dir_all(&base);
        let _ = fs::remove_dir_all(&home);
    }
}
