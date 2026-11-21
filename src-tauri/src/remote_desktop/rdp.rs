//! Cliente RDP sobre IronRDP (NLA/CredSSP + TLS).
//!
//! El certificado TLS del servidor no se valida contra una CA (los servidores Windows suelen
//! usar certificados autofirmados): se aplica TOFU. La huella SHA-256 se compara con la
//! almacenada en la bóveda y, si es nueva o ha cambiado, se pide confirmación al usuario
//! ANTES de enviar credenciales (CredSSP ocurre tras el TLS).
//!
//! Alcance actual: vídeo, ratón, teclado y TOFU. Quedan fuera de esta iteración el
//! portapapeles RDP (CLIPRDR) y el redimensionado dinámico (Display Control).

use super::error::RemoteDesktopError;
use super::frame::{self, DirtyCoalescer, Rect};
use super::input::InputEvent;
use super::transport::BoxedStream;
use super::{emit_state, fail, Credentials, EventSink, FrameSink, SessionCommand, SessionEvent, SyncStream, FLUSH_INTERVAL_MS};
use ironrdp_connector::{self as connector, ClientConnector};
use ironrdp_graphics::image_processing::PixelFormat;
use ironrdp_input::{Database, MouseButton, MousePosition, Operation, Scancode, WheelRotations};
use ironrdp_session::image::DecodedImage;
use ironrdp_session::{ActiveStageBuilder, ActiveStageOutput};
use ironrdp_tokio::{connect_begin, connect_finalize, mark_as_upgraded, split_tokio_framed, FramedWrite, NetworkClient, TokioFramed};
use sha2::{Digest, Sha256};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use x509_cert::der::Encode;

/// Tiempo máximo que se espera a que el usuario acepte/rechace el certificado.
pub const CERT_DECISION_TIMEOUT: Duration = Duration::from_secs(120);

pub struct RdpParams {
    pub hostname: String,
    pub credentials: Credentials,
    pub width: u16,
    pub height: u16,
    /// Huella (hex SHA-256) aceptada previamente para este host.
    pub known_fingerprint: Option<String>,
    /// Persiste la huella aceptada por el usuario.
    pub store_fingerprint: Arc<dyn Fn(&str) + Send + Sync>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum CertCheck {
    Trusted,
    New,
    Changed,
}

pub fn fingerprint_hex(der: &[u8]) -> String {
    Sha256::digest(der).iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn check_fingerprint(known: Option<&str>, presented: &str) -> CertCheck {
    match known {
        None => CertCheck::New,
        Some(k) if k.eq_ignore_ascii_case(presented) => CertCheck::Trusted,
        Some(_) => CertCheck::Changed,
    }
}

/// Cliente de red nulo: sin Kerberos (solo NTLM/CredSSP), por lo que nunca hay peticiones.
struct NoNetwork;

impl NetworkClient for NoNetwork {
    async fn send(&mut self, _req: &connector::sspi::NetworkRequest) -> connector::ConnectorResult<Vec<u8>> {
        Err(connector::general_err!("Kerberos is not supported; using NTLM"))
    }
}

/// Traduce un evento de entrada del frontend a operaciones de IronRDP.
pub fn input_operations(db: &Database, ev: &InputEvent) -> Vec<Operation> {
    match ev {
        InputEvent::Key { scancode, extended, down, .. } => {
            let sc = Scancode::from_u8(*extended, *scancode as u8);
            vec![if *down { Operation::KeyPressed(sc) } else { Operation::KeyReleased(sc) }]
        }
        InputEvent::Pointer { x, y, buttons } => {
            let mut ops = vec![Operation::MouseMove(MousePosition { x: *x, y: *y })];
            for (bit, button) in [(0b001u8, MouseButton::Left), (0b010, MouseButton::Middle), (0b100, MouseButton::Right)] {
                let want = buttons & bit != 0;
                let have = db.is_mouse_button_pressed(button);
                if want && !have {
                    ops.push(Operation::MouseButtonPressed(button));
                } else if !want && have {
                    ops.push(Operation::MouseButtonReleased(button));
                }
            }
            ops
        }
        InputEvent::Wheel { x, y, dx, dy } => {
            let mut ops = vec![Operation::MouseMove(MousePosition { x: *x, y: *y })];
            if *dy != 0 {
                ops.push(Operation::WheelRotations(WheelRotations { is_vertical: true, rotation_units: dy.saturating_mul(120) }));
            }
            if *dx != 0 {
                ops.push(Operation::WheelRotations(WheelRotations { is_vertical: false, rotation_units: dx.saturating_mul(120) }));
            }
            ops
        }
    }
}

pub fn build_config(creds: &Credentials, width: u16, height: u16) -> connector::Config {
    connector::Config {
        desktop_size: connector::DesktopSize { width, height },
        monitor_layout: None,
        desktop_scale_factor: 0,
        desktop_physical_size: None,
        desktop_orientation: None,
        device_scale_factor: None,
        monitor_extended_layout: None,
        relative_mouse_input: false,
        enable_tls: true,
        enable_credssp: true,
        enable_standard_rdp_security: false,
        credentials: connector::Credentials::UsernamePassword {
            username: creds.username.clone(),
            password: creds.password.to_string(),
        },
        domain: creds.domain.clone(),
        client_build: 0,
        client_name: "nexus-term".to_owned(),
        keyboard_type: ironrdp_pdu::gcc::KeyboardType::IBM_ENHANCED,
        keyboard_subtype: 0,
        keyboard_functional_keys_count: 12,
        keyboard_layout: 0,
        connection_type: ironrdp_pdu::gcc::ConnectionType::Lan,
        ime_file_name: String::new(),
        bitmap: None,
        dig_product_id: String::new(),
        client_dir: "C:\\Windows\\System32\\mstscax.dll".to_owned(),
        alternate_shell: String::new(),
        work_dir: String::new(),
        remote_application_mode: false,
        rail_support_level: ironrdp_pdu::rdp::capability_sets::RailSupportLevel::empty(),
        platform: platform(),
        hardware_id: None,
        request_data: None,
        autologon: false,
        enable_audio_playback: false,
        enable_audio_capture: false,
        performance_flags: Default::default(),
        license_cache: None,
        timezone_info: Default::default(),
        compression_type: None,
        enable_server_pointer: true,
        pointer_software_rendering: true,
        multitransport_flags: None,
        support_dyn_vc_gfx_protocol: false,
    }
}

fn platform() -> ironrdp_pdu::rdp::capability_sets::MajorPlatformType {
    use ironrdp_pdu::rdp::capability_sets::MajorPlatformType;
    #[cfg(windows)]
    return MajorPlatformType::WINDOWS;
    #[cfg(target_os = "macos")]
    return MajorPlatformType::MACINTOSH;
    #[cfg(not(any(windows, target_os = "macos")))]
    return MajorPlatformType::UNIX;
}

fn map_connect_error(e: impl std::fmt::Display) -> RemoteDesktopError {
    let msg = e.to_string();
    let lower = msg.to_lowercase();
    if lower.contains("credssp") || lower.contains("logon") || lower.contains("authentic") || lower.contains("access denied") {
        RemoteDesktopError::Authentication(msg)
    } else {
        RemoteDesktopError::Protocol(msg)
    }
}

/// Espera la decisión del usuario sobre un certificado nuevo/cambiado.
async fn await_cert_decision(cmds: &mut mpsc::Receiver<SessionCommand>) -> bool {
    let wait = async {
        while let Some(cmd) = cmds.recv().await {
            match cmd {
                SessionCommand::CertDecision(accept) => return accept,
                SessionCommand::Close => return false,
                _ => {}
            }
        }
        false
    };
    tokio::time::timeout(CERT_DECISION_TIMEOUT, wait).await.unwrap_or(false)
}

fn rect_from_inclusive(r: &ironrdp_pdu::geometry::InclusiveRectangle) -> Rect {
    Rect::new(r.left, r.top, r.right.saturating_sub(r.left) + 1, r.bottom.saturating_sub(r.top) + 1)
}

pub async fn run(
    stream: BoxedStream,
    params: RdpParams,
    mut cmds: mpsc::Receiver<SessionCommand>,
    frames: FrameSink,
    events: EventSink,
) -> Result<(), RemoteDesktopError> {
    emit_state(&events, "connecting");
    let result = run_inner(stream, params, &mut cmds, &frames, &events).await;
    match result {
        Ok(()) | Err(RemoteDesktopError::SessionClosed) => {
            emit_state(&events, "disconnected");
            Ok(())
        }
        Err(e) => {
            fail(&events, &e);
            Err(e)
        }
    }
}

async fn run_inner(
    stream: BoxedStream,
    params: RdpParams,
    cmds: &mut mpsc::Receiver<SessionCommand>,
    frames: &FrameSink,
    events: &EventSink,
) -> Result<(), RemoteDesktopError> {
    let config = build_config(&params.credentials, params.width, params.height);
    let client_addr: SocketAddr = ([127, 0, 0, 1], 0).into();
    let mut connector = ClientConnector::new(config, client_addr);

    let mut framed = TokioFramed::new(SyncStream::new(stream));
    let should_upgrade = connect_begin(&mut framed, &mut connector).await.map_err(map_connect_error)?;
    let initial = framed.into_inner_no_leftover();

    let (tls, cert) = ironrdp_tls::upgrade_with_certificate_validation(
        initial,
        &params.hostname,
        ironrdp_tls::CertificateValidation::DangerouslyAcceptInvalidCertificate,
    )
    .await
    .map_err(|e| RemoteDesktopError::Protocol(format!("TLS failure: {}", e)))?;

    let der = cert.to_der().map_err(|e| RemoteDesktopError::Protocol(format!("Certificado ilegible: {}", e)))?;
    let fp = fingerprint_hex(&der);
    match check_fingerprint(params.known_fingerprint.as_deref(), &fp) {
        CertCheck::Trusted => {}
        check => {
            events(SessionEvent::CertPrompt { fingerprint: fp.clone(), changed: check == CertCheck::Changed });
            if !await_cert_decision(cmds).await {
                return Err(RemoteDesktopError::CertificateRejected(fp));
            }
            (params.store_fingerprint)(&fp);
        }
    }

    let server_public_key = ironrdp_tls::extract_tls_server_public_key(&cert)
        .ok_or_else(|| RemoteDesktopError::Protocol("Certificate has no public key".into()))?
        .to_owned();

    let upgraded = mark_as_upgraded(should_upgrade, &mut connector);
    let mut framed = TokioFramed::new(tls);
    let outcome = connect_finalize(
        upgraded,
        connector,
        &mut framed,
        &mut NoNetwork,
        params.hostname.clone().into(),
        server_public_key,
        None,
    )
    .await
    .map_err(map_connect_error)?;
    let connection = match outcome {
        connector::ConnectionOutcome::Connected(c) => c,
        _ => return Err(RemoteDesktopError::Protocol("The server requested a redirect (unsupported)".into())),
    };

    let (w, h) = (connection.desktop_size.width, connection.desktop_size.height);
    let mut image = DecodedImage::new(PixelFormat::RgbA32, w, h);
    let mut stage = ActiveStageBuilder {
        static_channels: connection.static_channels,
        user_channel_id: connection.user_channel_id,
        io_channel_id: connection.io_channel_id,
        message_channel_id: connection.message_channel_id,
        share_id: connection.share_id,
        compression_type: connection.compression_type,
        enable_server_pointer: connection.enable_server_pointer,
        pointer_software_rendering: connection.pointer_software_rendering,
    }
    .build();

    frames(frame::encode_resize(w, h)?);
    emit_state(events, "connected");

    let (mut reader, mut writer) = split_tokio_framed(framed);
    let mut db = Database::new();
    let mut dirty = DirtyCoalescer::new();
    dirty.push(Rect::new(0, 0, w, h));
    let mut ticker = tokio::time::interval(Duration::from_millis(FLUSH_INTERVAL_MS));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        tokio::select! {
            pdu = reader.read_pdu() => {
                let (action, payload) = pdu.map_err(|_| RemoteDesktopError::SessionClosed)?;
                let outputs = stage
                    .process(&mut image, action, &payload, None)
                    .map_err(|e| RemoteDesktopError::Protocol(e.to_string()))?;
                for out in outputs {
                    match out {
                        ActiveStageOutput::ResponseFrame(buf) => {
                            writer.write_all(&buf).await.map_err(|_| RemoteDesktopError::SessionClosed)?;
                        }
                        ActiveStageOutput::GraphicsUpdate(r) => dirty.push(rect_from_inclusive(&r)),
                        ActiveStageOutput::PointerBitmap(p) => {
                            if let Ok(buf) = frame::encode_cursor((p.hotspot_x, p.hotspot_y), p.width, p.height, &p.bitmap_data) {
                                frames(buf);
                            }
                        }
                        ActiveStageOutput::PointerDefault => {
                            if let Ok(buf) = frame::encode_cursor((0, 0), 0, 0, &[]) { frames(buf); }
                        }
                        ActiveStageOutput::Terminate(_) => return Ok(()),
                        _ => {}
                    }
                }
            }
            cmd = cmds.recv() => {
                match cmd {
                    None | Some(SessionCommand::Close) => return Ok(()),
                    Some(SessionCommand::Input(ev)) => {
                        ev.validate()?;
                        let fp_events = db.apply(input_operations(&db, &ev));
                        if !fp_events.is_empty() {
                            let outs = stage
                                .process_fastpath_input(&mut image, &fp_events)
                                .map_err(|e| RemoteDesktopError::Protocol(e.to_string()))?;
                            for out in outs {
                                if let ActiveStageOutput::ResponseFrame(buf) = out {
                                    writer.write_all(&buf).await.map_err(|_| RemoteDesktopError::SessionClosed)?;
                                }
                            }
                        }
                    }
                    Some(SessionCommand::CtrlAltDel) => {
                        let seq = [
                            Operation::KeyPressed(Scancode::from_u8(false, 0x1d)),
                            Operation::KeyPressed(Scancode::from_u8(false, 0x38)),
                            Operation::KeyPressed(Scancode::from_u8(true, 0x53)),
                            Operation::KeyReleased(Scancode::from_u8(true, 0x53)),
                            Operation::KeyReleased(Scancode::from_u8(false, 0x38)),
                            Operation::KeyReleased(Scancode::from_u8(false, 0x1d)),
                        ];
                        let fp_events = db.apply(seq);
                        let outs = stage
                            .process_fastpath_input(&mut image, &fp_events)
                            .map_err(|e| RemoteDesktopError::Protocol(e.to_string()))?;
                        for out in outs {
                            if let ActiveStageOutput::ResponseFrame(buf) = out {
                                writer.write_all(&buf).await.map_err(|_| RemoteDesktopError::SessionClosed)?;
                            }
                        }
                    }
                    // Pendientes en esta iteración: portapapeles (CLIPRDR) y Display Control.
                    Some(SessionCommand::Clipboard(_)) | Some(SessionCommand::Resize { .. }) | Some(SessionCommand::CertDecision(_)) => {}
                }
            }
            _ = ticker.tick() => {
                if !dirty.is_empty() {
                    let (iw, ih) = (image.width(), image.height());
                    for r in dirty.take() {
                        if r.right() > iw as u32 || r.bottom() > ih as u32 { continue; }
                        let data = frame::extract_region(image.data(), iw, &r);
                        if let Ok(buf) = frame::encode_rect(&r, &data) && !frames(buf) {
                            return Ok(());
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zeroize::Zeroizing;

    fn creds() -> Credentials {
        Credentials { username: "admin".into(), password: Zeroizing::new("s3cret".into()), domain: Some("CORP".into()) }
    }

    #[test]
    fn test_fingerprint_hex_is_sha256() {
        assert_eq!(
            fingerprint_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(fingerprint_hex(b"abc").len(), 64);
    }

    #[test]
    fn test_check_fingerprint_tofu_states() {
        let fp = fingerprint_hex(b"cert-a");
        assert_eq!(check_fingerprint(None, &fp), CertCheck::New);
        assert_eq!(check_fingerprint(Some(&fp), &fp), CertCheck::Trusted);
        assert_eq!(check_fingerprint(Some(&fp.to_uppercase()), &fp), CertCheck::Trusted);
        assert_eq!(check_fingerprint(Some(&fingerprint_hex(b"cert-b")), &fp), CertCheck::Changed);
    }

    #[test]
    fn test_build_config_uses_nla_tls_and_credentials() {
        let c = build_config(&creds(), 1280, 720);
        assert!(c.enable_credssp && c.enable_tls);
        assert!(!c.enable_standard_rdp_security);
        assert_eq!((c.desktop_size.width, c.desktop_size.height), (1280, 720));
        assert_eq!(c.domain.as_deref(), Some("CORP"));
    }

    #[test]
    fn test_connect_error_classification() {
        assert!(matches!(map_connect_error("CredSSP failed"), RemoteDesktopError::Authentication(_)));
        assert!(matches!(map_connect_error("unexpected PDU"), RemoteDesktopError::Protocol(_)));
    }

    #[test]
    fn test_input_operations_key_and_wheel() {
        let db = Database::new();
        let ops = input_operations(&db, &InputEvent::Key { scancode: 0x1e, extended: false, down: true, keysym: None });
        assert!(matches!(ops[0], Operation::KeyPressed(_)));
        let ops = input_operations(&db, &InputEvent::Wheel { x: 1, y: 2, dx: 0, dy: -2 });
        assert!(matches!(ops[1], Operation::WheelRotations(WheelRotations { is_vertical: true, rotation_units: -240 })));
        assert_eq!(ops.len(), 2);
    }

    #[test]
    fn test_pointer_button_diff_uses_database_state() {
        let mut db = Database::new();
        let press = input_operations(&db, &InputEvent::Pointer { x: 5, y: 5, buttons: 0b001 });
        assert!(press.iter().any(|o| matches!(o, Operation::MouseButtonPressed(MouseButton::Left))));
        let events = db.apply(press);
        assert!(!events.is_empty());
        let hold = input_operations(&db, &InputEvent::Pointer { x: 6, y: 5, buttons: 0b001 });
        assert!(!hold.iter().any(|o| matches!(o, Operation::MouseButtonPressed(_))));
        let release = input_operations(&db, &InputEvent::Pointer { x: 6, y: 5, buttons: 0 });
        assert!(release.iter().any(|o| matches!(o, Operation::MouseButtonReleased(MouseButton::Left))));
    }

    #[test]
    fn test_inclusive_rect_conversion() {
        let r = ironrdp_pdu::geometry::InclusiveRectangle { left: 10, top: 20, right: 19, bottom: 29 };
        assert_eq!(rect_from_inclusive(&r), Rect::new(10, 20, 10, 10));
    }

    #[tokio::test]
    async fn test_cert_decision_accept_reject_and_close() {
        let (tx, mut rx) = mpsc::channel(4);
        tx.send(SessionCommand::Clipboard("x".into())).await.unwrap();
        tx.send(SessionCommand::CertDecision(true)).await.unwrap();
        assert!(await_cert_decision(&mut rx).await);
        tx.send(SessionCommand::CertDecision(false)).await.unwrap();
        assert!(!await_cert_decision(&mut rx).await);
        tx.send(SessionCommand::Close).await.unwrap();
        assert!(!await_cert_decision(&mut rx).await);
        drop(tx);
        assert!(!await_cert_decision(&mut rx).await);
    }
}
