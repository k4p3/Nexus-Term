use super::models::ParsedHostEntry;

pub fn parse_ssh_config(content: &str) -> Vec<ParsedHostEntry> {
    let mut entries = Vec::new();
    let mut current_aliases: Vec<String> = Vec::new();
    let mut current_hostname: Option<String> = None;
    let mut current_user: Option<String> = None;
    let mut current_port: Option<u16> = None;
    let mut current_identity_file: Option<String> = None;
    let mut current_proxy_jump: Option<String> = None;

    let flush_current = |entries: &mut Vec<ParsedHostEntry>,
                         aliases: &mut Vec<String>,
                         hostname: &mut Option<String>,
                         user: &mut Option<String>,
                         port: &mut Option<u16>,
                         identity_file: &mut Option<String>,
                         proxy_jump: &mut Option<String>| {
        if aliases.is_empty() {
            return;
        }

        for alias in aliases.drain(..) {
            // Skip wildcards
            if alias.contains('*') || alias.contains('?') {
                continue;
            }

            let effective_hostname = hostname
                .clone()
                .unwrap_or_else(|| alias.clone());

            entries.push(ParsedHostEntry {
                alias,
                hostname: effective_hostname,
                port: port.unwrap_or(22),
                user: user.clone(),
                identity_file: identity_file.clone(),
                proxy_jump: proxy_jump.clone(),
                is_duplicate: false,
            });
        }

        *hostname = None;
        *user = None;
        *port = None;
        *identity_file = None;
        *proxy_jump = None;
    };

    for line in content.lines() {
        let trimmed = line.trim();

        // Skip comments and empty lines
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        // Split on whitespace or '='
        let mut parts = trimmed.splitn(2, |c: char| c.is_whitespace() || c == '=');
        let key = parts.next().unwrap_or("").trim();
        let value = parts.next().unwrap_or("").trim().trim_matches('"');

        if key.eq_ignore_ascii_case("Host") {
            flush_current(
                &mut entries,
                &mut current_aliases,
                &mut current_hostname,
                &mut current_user,
                &mut current_port,
                &mut current_identity_file,
                &mut current_proxy_jump,
            );

            // Host can define multiple space-separated aliases
            for alias in value.split_whitespace() {
                let clean_alias = alias.trim_matches('"');
                if !clean_alias.is_empty() {
                    current_aliases.push(clean_alias.to_string());
                }
            }
        } else if key.eq_ignore_ascii_case("HostName") {
            if current_hostname.is_none() && !value.is_empty() {
                current_hostname = Some(value.to_string());
            }
        } else if key.eq_ignore_ascii_case("User") {
            if current_user.is_none() && !value.is_empty() {
                current_user = Some(value.to_string());
            }
        } else if key.eq_ignore_ascii_case("Port") {
            if current_port.is_none() {
                if let Ok(p) = value.parse::<u16>() {
                    current_port = Some(p);
                }
            }
        } else if key.eq_ignore_ascii_case("IdentityFile") {
            if current_identity_file.is_none() && !value.is_empty() {
                current_identity_file = Some(value.to_string());
            }
        } else if key.eq_ignore_ascii_case("ProxyJump") {
            if current_proxy_jump.is_none() && !value.is_empty() {
                current_proxy_jump = Some(value.to_string());
            }
        }
    }

    // Flush last entry
    flush_current(
        &mut entries,
        &mut current_aliases,
        &mut current_hostname,
        &mut current_user,
        &mut current_port,
        &mut current_identity_file,
        &mut current_proxy_jump,
    );

    entries
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ssh_config_basic() {
        let sample = r#"
# Global configuration (should be ignored)
Host *
    ServerAliveInterval 60
    TCPKeepAlive yes

# Development Server
Host dev-box
    HostName 192.168.1.105
    User ubuntu
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
    ProxyJump bastion-server

Host prod-api
    HostName api.nexus.internal
    User root
    Port 22
    IdentityFile ~/.ssh/prod.pem
"#;

        let parsed = parse_ssh_config(sample);
        assert_eq!(parsed.len(), 2);

        let dev = &parsed[0];
        assert_eq!(dev.alias, "dev-box");
        assert_eq!(dev.hostname, "192.168.1.105");
        assert_eq!(dev.user.as_deref(), Some("ubuntu"));
        assert_eq!(dev.port, 2222);
        assert_eq!(dev.identity_file.as_deref(), Some("~/.ssh/id_ed25519"));
        assert_eq!(dev.proxy_jump.as_deref(), Some("bastion-server"));

        let prod = &parsed[1];
        assert_eq!(prod.alias, "prod-api");
        assert_eq!(prod.hostname, "api.nexus.internal");
        assert_eq!(prod.user.as_deref(), Some("root"));
        assert_eq!(prod.port, 22);
        assert_eq!(prod.identity_file.as_deref(), Some("~/.ssh/prod.pem"));
        assert_eq!(prod.proxy_jump, None);
    }

    #[test]
    fn test_parse_ssh_config_implicit_hostname_and_multi_alias() {
        let sample = r#"
Host 10.0.0.1
    User admin

Host cluster-node-1 cluster-node-2
    HostName node.internal.net
    Port 2200
"#;

        let parsed = parse_ssh_config(sample);
        assert_eq!(parsed.len(), 3);

        assert_eq!(parsed[0].alias, "10.0.0.1");
        assert_eq!(parsed[0].hostname, "10.0.0.1");
        assert_eq!(parsed[0].user.as_deref(), Some("admin"));
        assert_eq!(parsed[0].port, 22);

        assert_eq!(parsed[1].alias, "cluster-node-1");
        assert_eq!(parsed[1].hostname, "node.internal.net");
        assert_eq!(parsed[1].port, 2200);

        assert_eq!(parsed[2].alias, "cluster-node-2");
        assert_eq!(parsed[2].hostname, "node.internal.net");
        assert_eq!(parsed[2].port, 2200);
    }
}
