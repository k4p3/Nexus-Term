use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TransferDirection {
    Upload,
    Download,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct SftpEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub permissions_octal: String,
    pub permissions_str: String,
    pub modified_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TransferProgress {
    pub transfer_id: String,
    pub direction: TransferDirection,
    pub filename: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub status: String, // "in_progress" | "completed" | "error" | "cancelled"
    pub error_message: Option<String>,
}

/// Convierte el modo numérico UNIX a representación estándar (ej. "drwxr-xr-x").
pub fn format_mode_to_string(mode: u32, is_dir: bool, is_symlink: bool) -> String {
    let type_char = if is_symlink {
        'l'
    } else if is_dir {
        'd'
    } else {
        '-'
    };

    let user_r = if mode & 0o400 != 0 { 'r' } else { '-' };
    let user_w = if mode & 0o200 != 0 { 'w' } else { '-' };
    let user_x = if mode & 0o100 != 0 { 'x' } else { '-' };

    let group_r = if mode & 0o040 != 0 { 'r' } else { '-' };
    let group_w = if mode & 0o020 != 0 { 'w' } else { '-' };
    let group_x = if mode & 0o010 != 0 { 'x' } else { '-' };

    let other_r = if mode & 0o004 != 0 { 'r' } else { '-' };
    let other_w = if mode & 0o002 != 0 { 'w' } else { '-' };
    let other_x = if mode & 0o001 != 0 { 'x' } else { '-' };

    format!(
        "{}{}{}{}{}{}{}{}{}{}",
        type_char, user_r, user_w, user_x, group_r, group_w, group_x, other_r, other_w, other_x
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_mode_to_string() {
        assert_eq!(
            format_mode_to_string(0o755, true, false),
            "drwxr-xr-x"
        );
        assert_eq!(
            format_mode_to_string(0o644, false, false),
            "-rw-r--r--"
        );
        assert_eq!(
            format_mode_to_string(0o777, false, true),
            "lrwxrwxrwx"
        );
        assert_eq!(
            format_mode_to_string(0o600, false, false),
            "-rw-------"
        );
    }
}
