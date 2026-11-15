use std::net::{Ipv4Addr, Ipv6Addr};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

pub const SOCKS5_VERSION: u8 = 0x05;
pub const METHOD_NO_AUTH: u8 = 0x00;
pub const CMD_CONNECT: u8 = 0x01;

pub const ATYP_IPV4: u8 = 0x01;
pub const ATYP_DOMAIN: u8 = 0x03;
pub const ATYP_IPV6: u8 = 0x04;

pub const REP_SUCCESS: u8 = 0x00;
pub const REP_GENERAL_FAILURE: u8 = 0x01;
pub const REP_HOST_UNREACHABLE: u8 = 0x04;
pub const REP_CONN_REFUSED: u8 = 0x05;
pub const REP_CMD_NOT_SUPPORTED: u8 = 0x07;
pub const REP_ADDR_TYPE_NOT_SUPPORTED: u8 = 0x08;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Socks5Target {
    pub host: String,
    pub port: u16,
}

/// Realiza el handshake inicial de negociación de métodos SOCKS5 (RFC 1928).
pub async fn handle_socks5_greeting<S>(stream: &mut S) -> Result<(), String>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    let mut header = [0u8; 2];
    stream
        .read_exact(&mut header)
        .await
        .map_err(|e| format!("Failed to read SOCKS5 greeting header: {}", e))?;

    if header[0] != SOCKS5_VERSION {
        return Err(format!("Unsupported SOCKS version: 0x{:02X}", header[0]));
    }

    let nmethods = header[1] as usize;
    let mut methods = vec![0u8; nmethods];
    stream
        .read_exact(&mut methods)
        .await
        .map_err(|e| format!("Failed to read SOCKS5 auth methods: {}", e))?;

    if !methods.contains(&METHOD_NO_AUTH) {
        let _ = stream.write_all(&[SOCKS5_VERSION, 0xFF]).await;
        return Err("Client does not support NO_AUTH method (0x00)".to_string());
    }

    // Responder que aceptamos método sin autenticación (0x00)
    stream
        .write_all(&[SOCKS5_VERSION, METHOD_NO_AUTH])
        .await
        .map_err(|e| format!("Failed to send SOCKS5 method acceptance: {}", e))?;
    stream
        .flush()
        .await
        .map_err(|e| format!("Failed to flush SOCKS5 method acceptance: {}", e))?;

    Ok(())
}

/// Lee y decodifica la solicitud de conexión SOCKS5 (CMD CONNECT).
pub async fn read_socks5_request<S>(stream: &mut S) -> Result<Socks5Target, String>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    let mut req_header = [0u8; 4];
    stream
        .read_exact(&mut req_header)
        .await
        .map_err(|e| format!("Failed to read SOCKS5 request header: {}", e))?;

    if req_header[0] != SOCKS5_VERSION {
        return Err(format!("Invalid SOCKS version in request: 0x{:02X}", req_header[0]));
    }

    let cmd = req_header[1];
    if cmd != CMD_CONNECT {
        let _ = send_socks5_reply(stream, REP_CMD_NOT_SUPPORTED).await;
        return Err(format!("Unsupported SOCKS5 command 0x{:02X} (only 0x01 CONNECT supported)", cmd));
    }

    let atyp = req_header[3];
    let host = match atyp {
        ATYP_IPV4 => {
            let mut octets = [0u8; 4];
            stream
                .read_exact(&mut octets)
                .await
                .map_err(|e| format!("Failed to read IPv4 address: {}", e))?;
            Ipv4Addr::from(octets).to_string()
        }
        ATYP_DOMAIN => {
            let mut len_buf = [0u8; 1];
            stream
                .read_exact(&mut len_buf)
                .await
                .map_err(|e| format!("Failed to read domain length: {}", e))?;
            let len = len_buf[0] as usize;
            let mut domain_buf = vec![0u8; len];
            stream
                .read_exact(&mut domain_buf)
                .await
                .map_err(|e| format!("Failed to read domain name: {}", e))?;
            String::from_utf8(domain_buf)
                .map_err(|e| format!("Domain name is not valid UTF-8: {}", e))?
        }
        ATYP_IPV6 => {
            let mut octets = [0u8; 16];
            stream
                .read_exact(&mut octets)
                .await
                .map_err(|e| format!("Failed to read IPv6 address: {}", e))?;
            Ipv6Addr::from(octets).to_string()
        }
        _ => {
            let _ = send_socks5_reply(stream, REP_ADDR_TYPE_NOT_SUPPORTED).await;
            return Err(format!("Unsupported address type: 0x{:02X}", atyp));
        }
    };

    let mut port_buf = [0u8; 2];
    stream
        .read_exact(&mut port_buf)
        .await
        .map_err(|e| format!("Failed to read target port: {}", e))?;
    let port = u16::from_be_bytes(port_buf);

    Ok(Socks5Target { host, port })
}

/// Envía la respuesta de estado SOCKS5 al cliente.
pub async fn send_socks5_reply<S>(stream: &mut S, rep: u8) -> Result<(), String>
where
    S: AsyncWrite + Unpin,
{
    // [VER, REP, RSV, ATYP(IPv4=0x01), 0,0,0,0, 0,0]
    let reply = [SOCKS5_VERSION, rep, 0x00, ATYP_IPV4, 0, 0, 0, 0, 0, 0];
    stream
        .write_all(&reply)
        .await
        .map_err(|e| format!("Failed to send SOCKS5 reply: {}", e))?;
    stream
        .flush()
        .await
        .map_err(|e| format!("Failed to flush SOCKS5 reply: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::duplex;

    #[tokio::test]
    async fn test_socks5_greeting_success() {
        let (mut client, mut server) = duplex(64);

        let client_task = tokio::spawn(async move {
            // Client sends: VER=5, NMETHODS=1, METHOD=0 (NO_AUTH)
            client.write_all(&[0x05, 0x01, 0x00]).await.unwrap();

            let mut resp = [0u8; 2];
            client.read_exact(&mut resp).await.unwrap();
            assert_eq!(resp, [0x05, 0x00]);
        });

        let server_result = handle_socks5_greeting(&mut server).await;
        assert!(server_result.is_ok());

        client_task.await.unwrap();
    }

    #[tokio::test]
    async fn test_socks5_request_ipv4_and_domain() {
        // Test IPv4
        {
            let (mut client, mut server) = duplex(64);
            let client_task = tokio::spawn(async move {
                // VER=5, CMD=1 (CONNECT), RSV=0, ATYP=1 (IPv4), 127.0.0.1, PORT=8080 (0x1F90)
                client
                    .write_all(&[0x05, 0x01, 0x00, 0x01, 127, 0, 0, 1, 0x1F, 0x90])
                    .await
                    .unwrap();
            });

            let target = read_socks5_request(&mut server).await.unwrap();
            assert_eq!(target.host, "127.0.0.1");
            assert_eq!(target.port, 8080);
            client_task.await.unwrap();
        }

        // Test Domain
        {
            let (mut client, mut server) = duplex(64);
            let client_task = tokio::spawn(async move {
                // VER=5, CMD=1, RSV=0, ATYP=3 (Domain), LEN=10, "google.com", PORT=443 (0x01BB)
                let mut payload = vec![0x05, 0x01, 0x00, 0x03, 10];
                payload.extend_from_slice(b"google.com");
                payload.extend_from_slice(&[0x01, 0xBB]);
                client.write_all(&payload).await.unwrap();
            });

            let target = read_socks5_request(&mut server).await.unwrap();
            assert_eq!(target.host, "google.com");
            assert_eq!(target.port, 443);
            client_task.await.unwrap();
        }
    }
}
