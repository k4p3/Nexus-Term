use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TunnelType {
    Local,
    Remote,
    Dynamic,
}

impl TunnelType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TunnelType::Local => "local",
            TunnelType::Remote => "remote",
            TunnelType::Dynamic => "dynamic",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "local" => Some(TunnelType::Local),
            "remote" => Some(TunnelType::Remote),
            "dynamic" => Some(TunnelType::Dynamic),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct TunnelConfig {
    pub id: String,
    pub host_id: String,
    pub name: String,
    pub tunnel_type: TunnelType,
    pub local_host: String,
    pub local_port: u16,
    pub remote_host: Option<String>,
    pub remote_port: Option<u16>,
    pub auto_start: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TunnelConfigPayload {
    pub id: Option<String>,
    pub host_id: String,
    pub name: String,
    pub tunnel_type: TunnelType,
    pub local_host: Option<String>,
    pub local_port: u16,
    pub remote_host: Option<String>,
    pub remote_port: Option<u16>,
    pub auto_start: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct TunnelRuntimeStatus {
    pub tunnel_id: String,
    pub status: String, // "active" | "stopped" | "error"
    pub error_message: Option<String>,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub active_connections: u32,
}
