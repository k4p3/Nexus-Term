use base64::prelude::*;
use sha2::{Digest, Sha256};

use super::models::ParsedKnownHost;

pub fn parse_known_hosts(content: &str) -> Vec<ParsedKnownHost> {
    let mut entries = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        // Skip comments, empty lines and hashed entries (|1|)
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with('@') || trimmed.starts_with('|') {
            continue;
        }

        let mut parts = trimmed.split_whitespace();
        let host_part = match parts.next() {
            Some(h) => h,
            None => continue,
        };
        let key_type = match parts.next() {
            Some(kt) => kt,
            None => continue,
        };
        let key_base64 = match parts.next() {
            Some(k) => k,
            None => continue,
        };

        // Calculate fingerprint SHA256:<base64-no-pad>
        let fingerprint = match BASE64_STANDARD.decode(key_base64) {
            Ok(bytes) => {
                let hash = Sha256::digest(&bytes);
                let fp_b64 = BASE64_STANDARD_NO_PAD.encode(hash);
                format!("SHA256:{}", fp_b64)
            }
            Err(_) => {
                let hash = Sha256::digest(key_base64.as_bytes());
                let fp_b64 = BASE64_STANDARD_NO_PAD.encode(hash);
                format!("SHA256:{}", fp_b64)
            }
        };

        // Split multiple host specifications (e.g. "github.com,140.82.121.4")
        for item in host_part.split(',') {
            let item = item.trim();
            if item.is_empty() {
                continue;
            }

            let (hostname, port) = if item.starts_with('[') {
                // Bracketed host: "[hostname]:port"
                if let Some(close_bracket) = item.find(']') {
                    let host = &item[1..close_bracket];
                    let port = if let Some(colon) = item[close_bracket..].find(':') {
                        item[close_bracket + colon + 1..].parse::<u16>().unwrap_or(22)
                    } else {
                        22
                    };
                    (host.to_string(), port)
                } else {
                    (item.to_string(), 22)
                }
            } else {
                (item.to_string(), 22)
            };

            entries.push(ParsedKnownHost {
                hostname,
                port,
                key_type: key_type.to_string(),
                public_key_base64: format!("{} {}", key_type, key_base64),
                fingerprint_sha256: fingerprint.clone(),
            });
        }
    }

    entries
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_known_hosts() {
        let sample = r#"
# Known hosts sample
github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
[192.168.1.50]:2222 ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC3... root@server
srv1.internal,10.0.0.10 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG...
|1|hashed_string= ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...
"#;

        let parsed = parse_known_hosts(sample);
        // github.com (1) + [192.168.1.50]:2222 (1) + srv1.internal & 10.0.0.10 (2) = 4
        assert_eq!(parsed.len(), 4);

        assert_eq!(parsed[0].hostname, "github.com");
        assert_eq!(parsed[0].port, 22);
        assert_eq!(parsed[0].key_type, "ssh-ed25519");
        assert!(parsed[0].fingerprint_sha256.starts_with("SHA256:"));

        assert_eq!(parsed[1].hostname, "192.168.1.50");
        assert_eq!(parsed[1].port, 2222);
        assert_eq!(parsed[1].key_type, "ssh-rsa");

        assert_eq!(parsed[2].hostname, "srv1.internal");
        assert_eq!(parsed[2].port, 22);

        assert_eq!(parsed[3].hostname, "10.0.0.10");
        assert_eq!(parsed[3].port, 22);
    }
}
