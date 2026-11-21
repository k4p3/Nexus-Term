use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{watch, Mutex, RwLock};

use crate::ssh::create_authenticated_ssh_session;
use crate::vault::db::VaultManager;
use super::models::{TunnelConfig, TunnelRuntimeStatus, TunnelType};
use super::socks5::{
    handle_socks5_greeting, read_socks5_request, send_socks5_reply, REP_HOST_UNREACHABLE,
    REP_SUCCESS,
};

pub struct RunningTunnel {
    pub config: TunnelConfig,
    pub status: Arc<RwLock<String>>,
    pub error_message: Arc<RwLock<Option<String>>>,
    pub bytes_sent: Arc<AtomicU64>,
    pub bytes_received: Arc<AtomicU64>,
    pub active_connections: Arc<AtomicU32>,
    pub stop_tx: watch::Sender<bool>,
}

#[derive(Default, Clone)]
pub struct SshTunnelManager {
    tunnels: Arc<Mutex<HashMap<String, RunningTunnel>>>,
}

impl SshTunnelManager {
    pub fn new() -> Self {
        Self {
            tunnels: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn start_tunnel(
        &self,
        vault_mgr: Arc<VaultManager>,
        tunnel: TunnelConfig,
    ) -> Result<(), String> {
        let tunnel_id = tunnel.id.clone();

        {
            let map = self.tunnels.lock().await;
            if let Some(running) = map.get(&tunnel_id) {
                let st = running.status.read().await;
                if *st == "active" {
                    return Ok(());
                }
            }
        }

        let status = Arc::new(RwLock::new("active".to_string()));
        let error_message = Arc::new(RwLock::new(None));
        let bytes_sent = Arc::new(AtomicU64::new(0));
        let bytes_received = Arc::new(AtomicU64::new(0));
        let active_connections = Arc::new(AtomicU32::new(0));
        let (stop_tx, mut stop_rx) = watch::channel(false);

        match tunnel.tunnel_type {
            TunnelType::Local => {
                let bind_addr = format!("{}:{}", tunnel.local_host, tunnel.local_port);
                let listener = match TcpListener::bind(&bind_addr).await {
                    Ok(l) => l,
                    Err(e) => {
                        let err_msg = format!("Puerto local no disponible ({}): {}", bind_addr, e);
                        *status.write().await = "error".to_string();
                        *error_message.write().await = Some(err_msg.clone());
                        return Err(err_msg);
                    }
                };

                let session = match create_authenticated_ssh_session(vault_mgr, &tunnel.host_id).await {
                    Ok(s) => Arc::new(Mutex::new(s)),
                    Err(e) => {
                        let err_msg = format!("SSH authentication failed while starting the tunnel: {}", e);
                        *status.write().await = "error".to_string();
                        *error_message.write().await = Some(err_msg.clone());
                        return Err(err_msg);
                    }
                };

                let status_clone = status.clone();
                let b_sent = bytes_sent.clone();
                let b_recv = bytes_received.clone();
                let active_conns = active_connections.clone();
                let rem_host = tunnel.remote_host.clone().unwrap_or_else(|| "127.0.0.1".to_string());
                let rem_port = tunnel.remote_port.unwrap_or(22);
                let session_for_loop = session.clone();

                tokio::spawn(async move {
                    loop {
                        tokio::select! {
                            _ = stop_rx.changed() => {
                                break;
                            }
                            res = listener.accept() => {
                                match res {
                                    Ok((socket, _)) => {
                                        let session_clone = session_for_loop.clone();
                                        let b_sent_inner = b_sent.clone();
                                        let b_recv_inner = b_recv.clone();
                                        let active_conns_inner = active_conns.clone();
                                        let target_host = rem_host.clone();

                                        tokio::spawn(async move {
                                            active_conns_inner.fetch_add(1, Ordering::SeqCst);
                                            let channel_res = {
                                                let sess = session_clone.lock().await;
                                                sess.channel_open_direct_tcpip(
                                                    &target_host,
                                                    rem_port as u32,
                                                    "127.0.0.1",
                                                    0,
                                                )
                                                .await
                                            };
                                            if let Ok(channel) = channel_res {
                                                pipe_bidirectional(socket, channel, b_sent_inner, b_recv_inner).await;
                                            }
                                            active_conns_inner.fetch_sub(1, Ordering::SeqCst);
                                        });
                                    }
                                    Err(_) => break,
                                }
                            }
                        }
                    }
                    let _ = session_for_loop.lock().await.disconnect(russh::Disconnect::ByApplication, "", "en").await;
                    *status_clone.write().await = "stopped".to_string();
                });
            }
            TunnelType::Dynamic => {
                let bind_addr = format!("{}:{}", tunnel.local_host, tunnel.local_port);
                let listener = match TcpListener::bind(&bind_addr).await {
                    Ok(l) => l,
                    Err(e) => {
                        let err_msg = format!("Puerto local no disponible para SOCKS5 ({}): {}", bind_addr, e);
                        *status.write().await = "error".to_string();
                        *error_message.write().await = Some(err_msg.clone());
                        return Err(err_msg);
                    }
                };

                let session = match create_authenticated_ssh_session(vault_mgr, &tunnel.host_id).await {
                    Ok(s) => Arc::new(Mutex::new(s)),
                    Err(e) => {
                        let err_msg = format!("SSH authentication failed while starting SOCKS5: {}", e);
                        *status.write().await = "error".to_string();
                        *error_message.write().await = Some(err_msg.clone());
                        return Err(err_msg);
                    }
                };

                let status_clone = status.clone();
                let b_sent = bytes_sent.clone();
                let b_recv = bytes_received.clone();
                let active_conns = active_connections.clone();
                let session_for_loop = session.clone();

                tokio::spawn(async move {
                    loop {
                        tokio::select! {
                            _ = stop_rx.changed() => {
                                break;
                            }
                            res = listener.accept() => {
                                match res {
                                    Ok((mut socket, _)) => {
                                        let session_clone = session_for_loop.clone();
                                        let b_sent_inner = b_sent.clone();
                                        let b_recv_inner = b_recv.clone();
                                        let active_conns_inner = active_conns.clone();

                                        tokio::spawn(async move {
                                            active_conns_inner.fetch_add(1, Ordering::SeqCst);
                                            if handle_socks5_greeting(&mut socket).await.is_ok() {
                                                match read_socks5_request(&mut socket).await {
                                                    Ok(target) => {
                                                        let channel_res = {
                                                            let sess = session_clone.lock().await;
                                                            sess.channel_open_direct_tcpip(
                                                                &target.host,
                                                                target.port as u32,
                                                                "127.0.0.1",
                                                                0,
                                                            )
                                                            .await
                                                        };
                                                        match channel_res {
                                                            Ok(channel) => {
                                                                let _ = send_socks5_reply(&mut socket, REP_SUCCESS).await;
                                                                pipe_bidirectional(socket, channel, b_sent_inner, b_recv_inner).await;
                                                            }
                                                            Err(_) => {
                                                                let _ = send_socks5_reply(&mut socket, REP_HOST_UNREACHABLE).await;
                                                            }
                                                        }
                                                    }
                                                    Err(_) => {}
                                                }
                                            }
                                            active_conns_inner.fetch_sub(1, Ordering::SeqCst);
                                        });
                                    }
                                    Err(_) => break,
                                }
                            }
                        }
                    }
                    let _ = session_for_loop.lock().await.disconnect(russh::Disconnect::ByApplication, "", "en").await;
                    *status_clone.write().await = "stopped".to_string();
                });
            }
            TunnelType::Remote => {
                let mut session = match create_authenticated_ssh_session(vault_mgr, &tunnel.host_id).await {
                    Ok(s) => s,
                    Err(e) => {
                        let err_msg = format!("SSH authentication failed while starting the remote tunnel: {}", e);
                        *status.write().await = "error".to_string();
                        *error_message.write().await = Some(err_msg.clone());
                        return Err(err_msg);
                    }
                };

                let rem_host = tunnel.remote_host.as_deref().unwrap_or("0.0.0.0");
                let rem_port = tunnel.remote_port.unwrap_or(8080) as u32;

                match session.tcpip_forward(rem_host, rem_port).await {
                    Ok(_) => {}
                    Err(e) => {
                        let err_msg = format!("The remote SSH server rejected binding port {}: {}", rem_port, e);
                        *status.write().await = "error".to_string();
                        *error_message.write().await = Some(err_msg.clone());
                        return Err(err_msg);
                    }
                }

                let status_clone = status.clone();
                let rem_host_owned = rem_host.to_string();

                tokio::spawn(async move {
                    loop {
                        tokio::select! {
                            _ = stop_rx.changed() => {
                                let _ = session.cancel_tcpip_forward(&rem_host_owned, rem_port).await;
                                break;
                            }
                            _ = tokio::time::sleep(tokio::time::Duration::from_millis(500)) => {}
                        }
                    }
                    let _ = session.disconnect(russh::Disconnect::ByApplication, "", "en").await;
                    *status_clone.write().await = "stopped".to_string();
                });
            }
        }

        let mut map = self.tunnels.lock().await;
        map.insert(
            tunnel_id,
            RunningTunnel {
                config: tunnel,
                status,
                error_message,
                bytes_sent,
                bytes_received,
                active_connections,
                stop_tx,
            },
        );

        Ok(())
    }

    pub async fn stop_tunnel(&self, tunnel_id: &str) -> Result<(), String> {
        let map = self.tunnels.lock().await;
        if let Some(running) = map.get(tunnel_id) {
            let _ = running.stop_tx.send(true);
            *running.status.write().await = "stopped".to_string();
            Ok(())
        } else {
            Ok(())
        }
    }

    pub async fn get_statuses(&self) -> HashMap<String, TunnelRuntimeStatus> {
        let map = self.tunnels.lock().await;
        let mut result = HashMap::new();

        for (id, running) in map.iter() {
            let status = running.status.read().await.clone();
            let error_message = running.error_message.read().await.clone();
            let bytes_sent = running.bytes_sent.load(Ordering::Relaxed);
            let bytes_received = running.bytes_received.load(Ordering::Relaxed);
            let active_connections = running.active_connections.load(Ordering::Relaxed);

            result.insert(
                id.clone(),
                TunnelRuntimeStatus {
                    tunnel_id: id.clone(),
                    status,
                    error_message,
                    bytes_sent,
                    bytes_received,
                    active_connections,
                },
            );
        }

        result
    }
}

async fn pipe_bidirectional(
    mut socket: TcpStream,
    mut channel: russh::Channel<russh::client::Msg>,
    bytes_sent: Arc<AtomicU64>,
    bytes_received: Arc<AtomicU64>,
) {
    let (mut sock_read, mut sock_write) = socket.split();
    let mut buf = [0u8; 8192];
    loop {
        tokio::select! {
            res = sock_read.read(&mut buf) => {
                match res {
                    Ok(0) => {
                        let _ = channel.eof().await;
                        break;
                    }
                    Ok(n) => {
                        bytes_sent.fetch_add(n as u64, Ordering::Relaxed);
                        if channel.data(&buf[..n]).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
            msg = channel.wait() => {
                match msg {
                    Some(russh::ChannelMsg::Data { ref data }) => {
                        bytes_received.fetch_add(data.len() as u64, Ordering::Relaxed);
                        if sock_write.write_all(data).await.is_err() {
                            break;
                        }
                    }
                    Some(russh::ChannelMsg::Eof) | Some(russh::ChannelMsg::Close) | None => {
                        break;
                    }
                    _ => {}
                }
            }
        }
    }
}
