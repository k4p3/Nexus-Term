use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ParsedHostEntry {
    pub alias: String,
    pub hostname: String,
    pub port: u16,
    pub user: Option<String>,
    pub identity_file: Option<String>,
    pub proxy_jump: Option<String>,
    pub is_duplicate: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshConfigPreview {
    pub config_path: String,
    pub known_hosts_path: String,
    pub config_found: bool,
    pub known_hosts_found: bool,
    pub hosts: Vec<ParsedHostEntry>,
    pub known_hosts_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportSshConfigPayload {
    pub selected_hosts: Vec<ParsedHostEntry>,
    pub folder_name: Option<String>,
    pub import_known_hosts: bool,
    pub overwrite_duplicates: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ImportSummary {
    pub hosts_imported: usize,
    pub hosts_skipped: usize,
    pub identities_created: usize,
    pub known_hosts_imported: usize,
    pub folder_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedKnownHost {
    pub hostname: String,
    pub port: u16,
    pub key_type: String,
    pub public_key_base64: String,
    pub fingerprint_sha256: String,
}
