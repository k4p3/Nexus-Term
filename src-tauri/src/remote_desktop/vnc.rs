//! Cliente VNC (RFB) sobre `vnc-rs`.
//!
//! Codificaciones anunciadas: ZRLE, CopyRect, Raw, Cursor y DesktopSize. Se omite Tight para
//! no recibir JPEG (evita un decodificador adicional); el servidor degrada a ZRLE/Raw.

use super::error::RemoteDesktopError;
use super::frame::{self, DirtyCoalescer, Framebuffer, Rect};
use super::input::{validate_clipboard_text, InputEvent};
use super::{emit_state, fail, EventSink, FrameSink, SessionCommand, SessionEvent, SyncStream, FLUSH_INTERVAL_MS};
use ::vnc::{
    ClientKeyEvent, ClientMouseEvent, PixelFormat, VncConnector, VncEncoding, VncError, VncEvent, X11Event,
};
use std::time::Duration;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::sync::mpsc;
use zeroize::Zeroizing;

const MAX_EVENTS_PER_TICK: usize = 512;
const MAX_WHEEL_NOTCHES: i16 = 10;

const BTN_WHEEL_UP: u8 = 0x08;
const BTN_WHEEL_DOWN: u8 = 0x10;
const BTN_WHEEL_LEFT: u8 = 0x20;
const BTN_WHEEL_RIGHT: u8 = 0x40;

const KS_CONTROL_L: u32 = 0xffe3;
const KS_ALT_L: u32 = 0xffe9;
const KS_DELETE: u32 = 0xffff;

/// Scancode PC/AT (set 1) → keysym X11 para distribución US. Es un respaldo: el frontend
/// envía `keysym` cuando la tecla produce un carácter imprimible.
pub fn scancode_to_keysym(scancode: u16, extended: bool) -> Option<u32> {
    if extended {
        return Some(match scancode {
            0x1c => 0xff8d, // KP_Enter
            0x1d => 0xffe4, // Control_R
            0x35 => 0xffaf, // KP_Divide
            0x38 => 0xffea, // Alt_R
            0x47 => 0xff50, // Home
            0x48 => 0xff52, // Up
            0x49 => 0xff55, // Page_Up
            0x4b => 0xff51, // Left
            0x4d => 0xff53, // Right
            0x4f => 0xff57, // End
            0x50 => 0xff54, // Down
            0x51 => 0xff56, // Page_Down
            0x52 => 0xff63, // Insert
            0x53 => 0xffff, // Delete
            0x5b => 0xffeb, // Super_L
            0x5c => 0xffec, // Super_R
            0x5d => 0xff67, // Menu
            _ => return None,
        });
    }
    const LETTERS_Q: &[u8] = b"qwertyuiop";
    const LETTERS_A: &[u8] = b"asdfghjkl";
    const LETTERS_Z: &[u8] = b"zxcvbnm";
    Some(match scancode {
        0x01 => 0xff1b,
        0x02..=0x0a => 0x31 + (scancode as u32 - 0x02),
        0x0b => 0x30,
        0x0c => 0x2d,
        0x0d => 0x3d,
        0x0e => 0xff08,
        0x0f => 0xff09,
        0x10..=0x19 => LETTERS_Q[(scancode - 0x10) as usize] as u32,
        0x1a => 0x5b,
        0x1b => 0x5d,
        0x1c => 0xff0d,
        0x1d => KS_CONTROL_L,
        0x1e..=0x26 => LETTERS_A[(scancode - 0x1e) as usize] as u32,
        0x27 => 0x3b,
        0x28 => 0x27,
        0x29 => 0x60,
        0x2a => 0xffe1,
        0x2b => 0x5c,
        0x2c..=0x32 => LETTERS_Z[(scancode - 0x2c) as usize] as u32,
        0x33 => 0x2c,
        0x34 => 0x2e,
        0x35 => 0x2f,
        0x36 => 0xffe2,
        0x37 => 0xffaa,
        0x38 => KS_ALT_L,
        0x39 => 0x20,
        0x3a => 0xffe5,
        0x3b..=0x44 => 0xffbe + (scancode as u32 - 0x3b),
        0x45 => 0xff7f,
        0x46 => 0xff14,
        0x47 => 0xffb7,
        0x48 => 0xffb8,
        0x49 => 0xffb9,
        0x4a => 0xffad,
        0x4b => 0xffb4,
        0x4c => 0xffb5,
        0x4d => 0xffb6,
        0x4e => 0xffab,
        0x4f => 0xffb1,
        0x50 => 0xffb2,
        0x51 => 0xffb3,
        0x52 => 0xffb0,
        0x53 => 0xffae,
        0x57 => 0xffc8,
        0x58 => 0xffc9,
        _ => return None,
    })
}

/// El protocolo VNC clásico solo transporta Latin-1 en el portapapeles.
pub fn to_latin1_lossy(text: &str) -> String {
    text.chars().map(|c| if (c as u32) <= 0xFF { c } else { '?' }).collect()
}

fn map_vnc_error(e: VncError) -> RemoteDesktopError {
    match e {
        VncError::WrongPassword | VncError::NoPassword => {
            RemoteDesktopError::Authentication("VNC password is wrong or missing".into())
        }
        other => RemoteDesktopError::Protocol(other.to_string()),
    }
}

struct Session {
    fb: Framebuffer,
    dirty: DirtyCoalescer,
    buttons: u8,
}

/// Ejecuta una sesión VNC hasta que se cierre (usuario, servidor o error).
pub async fn run<S>(
    stream: S,
    password: Option<Zeroizing<String>>,
    mut cmds: mpsc::Receiver<SessionCommand>,
    frames: FrameSink,
    events: EventSink,
) -> Result<(), RemoteDesktopError>
where
    S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    emit_state(&events, "connecting");
    let pw = password.map(|p| p.to_string());
    let connector = VncConnector::new(SyncStream::new(stream))
        .set_auth_method(async move { pw.ok_or(VncError::NoPassword) })
        .add_encoding(VncEncoding::Zrle)
        .add_encoding(VncEncoding::CopyRect)
        .add_encoding(VncEncoding::Raw)
        .add_encoding(VncEncoding::CursorPseudo)
        .add_encoding(VncEncoding::DesktopSizePseudo)
        .allow_shared(true)
        .set_pixel_format(PixelFormat::rgba());

    let started = async {
        connector
            .build()
            .map_err(map_vnc_error)?
            .try_start()
            .await
            .map_err(map_vnc_error)?
            .finish()
            .map_err(map_vnc_error)
    }
    .await;
    let client = match started {
        Ok(c) => c,
        Err(e) => {
            fail(&events, &e);
            return Err(e);
        }
    };

    emit_state(&events, "connected");
    let mut s = Session { fb: Framebuffer::default(), dirty: DirtyCoalescer::new(), buttons: 0 };
    let mut ticker = tokio::time::interval(Duration::from_millis(FLUSH_INTERVAL_MS));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut result: Result<(), RemoteDesktopError> = Ok(());

    'main: loop {
        tokio::select! {
            cmd = cmds.recv() => {
                match cmd {
                    None | Some(SessionCommand::Close) => break 'main,
                    Some(c) => {
                        if let Err(e) = handle_command(&client, &mut s, c).await {
                            result = Err(e);
                            break 'main;
                        }
                    }
                }
            }
            _ = ticker.tick() => {
                // `poll_event` (no `recv_event`): este último retiene el mutex del cliente
                // mientras espera y bloquearía el envío de entrada.
                for _ in 0..MAX_EVENTS_PER_TICK {
                    match client.poll_event().await {
                        Ok(Some(ev)) => {
                            if let Err(e) = handle_event(ev, &mut s, &frames, &events) {
                                result = Err(e);
                                break 'main;
                            }
                        }
                        Ok(None) => break,
                        Err(_) => {
                            let _ = flush(&mut s, &frames);
                            emit_state(&events, "disconnected");
                            let _ = client.close().await;
                            return Ok(());
                        }
                    }
                }
                if !flush(&mut s, &frames) {
                    break 'main; // el frontend cerró el canal
                }
            }
        }
    }

    let _ = client.close().await;
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

/// Envía los rectángulos pendientes. `false` si el receptor desapareció.
fn flush(s: &mut Session, frames: &FrameSink) -> bool {
    if s.dirty.is_empty() {
        return true;
    }
    for r in s.dirty.take() {
        let data = s.fb.region(&r);
        match frame::encode_rect(&r, &data) {
            Ok(buf) => {
                if !frames(buf) {
                    return false;
                }
            }
            Err(_) => continue,
        }
    }
    true
}

fn rect_from(r: ::vnc::Rect) -> Rect {
    Rect::new(r.x, r.y, r.width, r.height)
}

fn handle_event(
    ev: VncEvent,
    s: &mut Session,
    frames: &FrameSink,
    events: &EventSink,
) -> Result<(), RemoteDesktopError> {
    match ev {
        VncEvent::SetResolution(screen) => {
            s.fb.resize(screen.width, screen.height)?;
            let _ = s.dirty.take();
            let buf = frame::encode_resize(screen.width, screen.height)?;
            frames(buf);
            // Imagen completa inicial (negra) para que el canvas tenga contenido consistente.
            s.dirty.push(Rect::new(0, 0, screen.width, screen.height));
        }
        VncEvent::RawImage(rect, data) => {
            let r = rect_from(rect);
            s.fb.blit_opaque(&r, &data)?;
            s.dirty.push(r);
        }
        VncEvent::Copy(dst, src) => {
            let (d, sr) = (rect_from(dst), rect_from(src));
            s.fb.copy_region(&d, &sr)?;
            s.dirty.push(d);
        }
        VncEvent::SetCursor(rect, data) => {
            let buf = if rect.width == 0 || rect.height == 0 || data.is_empty() {
                frame::encode_cursor((0, 0), 0, 0, &[])?
            } else {
                frame::encode_cursor((rect.x, rect.y), rect.width, rect.height, &data)?
            };
            frames(buf);
        }
        VncEvent::Text(text) => events(SessionEvent::Clipboard { text }),
        VncEvent::Error(msg) => {
            // El motor reporta aquí el cierre del socket (p. ej. "broken pipe"): es una
            // desconexión remota, no un fallo de protocolo.
            events(SessionEvent::Error { message: msg });
            return Err(RemoteDesktopError::SessionClosed);
        }
        _ => {} // Bell, JpegImage (no anunciado), SetPixelFormat, DesktopUpdate
    }
    Ok(())
}

async fn send(client: &::vnc::VncClient, ev: X11Event) -> Result<(), RemoteDesktopError> {
    client
        .input(ev)
        .await
        .map_err(|e| RemoteDesktopError::Protocol(format!("VNC input failed: {}", e)))
}

async fn handle_command(
    client: &::vnc::VncClient,
    s: &mut Session,
    cmd: SessionCommand,
) -> Result<(), RemoteDesktopError> {
    match cmd {
        SessionCommand::Input(ev) => {
            ev.validate()?;
            match ev {
                InputEvent::Key { scancode, extended, down, keysym } => {
                    if let Some(ks) = keysym.or_else(|| scancode_to_keysym(scancode, extended)) {
                        send(client, X11Event::KeyEvent(ClientKeyEvent { keycode: ks, down })).await?;
                    }
                }
                InputEvent::Pointer { x, y, buttons } => {
                    s.buttons = buttons;
                    send(client, X11Event::PointerEvent(ClientMouseEvent { position_x: x, position_y: y, bottons: buttons })).await?;
                }
                InputEvent::Wheel { x, y, dx, dy } => {
                    let mut pulses: Vec<u8> = Vec::new();
                    let n = |v: i16| v.unsigned_abs().min(MAX_WHEEL_NOTCHES as u16) as usize;
                    pulses.extend(std::iter::repeat_n(if dy > 0 { BTN_WHEEL_UP } else { BTN_WHEEL_DOWN }, n(dy)));
                    pulses.extend(std::iter::repeat_n(if dx > 0 { BTN_WHEEL_RIGHT } else { BTN_WHEEL_LEFT }, n(dx)));
                    for bit in pulses {
                        for mask in [s.buttons | bit, s.buttons] {
                            send(client, X11Event::PointerEvent(ClientMouseEvent { position_x: x, position_y: y, bottons: mask })).await?;
                        }
                    }
                }
            }
        }
        SessionCommand::CtrlAltDel => {
            let seq = [(KS_CONTROL_L, true), (KS_ALT_L, true), (KS_DELETE, true), (KS_DELETE, false), (KS_ALT_L, false), (KS_CONTROL_L, false)];
            for (keycode, down) in seq {
                send(client, X11Event::KeyEvent(ClientKeyEvent { keycode, down })).await?;
            }
        }
        SessionCommand::Clipboard(text) => {
            validate_clipboard_text(&text)?;
            send(client, X11Event::CopyText(to_latin1_lossy(&text))).await?;
        }
        SessionCommand::Resize { .. } => {} // VNC: escalado en el cliente
        SessionCommand::CertDecision(_) | SessionCommand::Close => {}
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};
    use tokio::io::{AsyncReadExt, AsyncWriteExt, DuplexStream};

    #[test]
    fn test_scancode_table_basics() {
        assert_eq!(scancode_to_keysym(0x1e, false), Some('a' as u32));
        assert_eq!(scancode_to_keysym(0x32, false), Some('m' as u32));
        assert_eq!(scancode_to_keysym(0x02, false), Some('1' as u32));
        assert_eq!(scancode_to_keysym(0x0b, false), Some('0' as u32));
        assert_eq!(scancode_to_keysym(0x39, false), Some(0x20));
        assert_eq!(scancode_to_keysym(0x3b, false), Some(0xffbe)); // F1
        assert_eq!(scancode_to_keysym(0x44, false), Some(0xffc7)); // F10
        assert_eq!(scancode_to_keysym(0x53, true), Some(0xffff)); // Delete
        assert_eq!(scancode_to_keysym(0x48, true), Some(0xff52)); // Up
        assert_eq!(scancode_to_keysym(0x7f, false), None);
        assert_eq!(scancode_to_keysym(0x7f, true), None);
    }

    #[test]
    fn test_latin1_filter() {
        assert_eq!(to_latin1_lossy("café ñ"), "café ñ");
        assert_eq!(to_latin1_lossy("hi€😀"), "hi??");
    }

    #[test]
    fn test_auth_errors_are_mapped() {
        assert!(matches!(map_vnc_error(VncError::WrongPassword), RemoteDesktopError::Authentication(_)));
        assert!(matches!(map_vnc_error(VncError::NoPassword), RemoteDesktopError::Authentication(_)));
        assert!(matches!(map_vnc_error(VncError::ConnectError), RemoteDesktopError::Protocol(_)));
    }

    fn test_session() -> Session {
        let mut fb = Framebuffer::default();
        fb.resize(4, 4).unwrap();
        Session { fb, dirty: DirtyCoalescer::new(), buttons: 0 }
    }

    type Sinks = (FrameSink, Arc<Mutex<Vec<Vec<u8>>>>, EventSink, Arc<Mutex<Vec<SessionEvent>>>);

    fn sinks() -> Sinks {
        let frames = Arc::new(Mutex::new(Vec::new()));
        let evs = Arc::new(Mutex::new(Vec::new()));
        let f = frames.clone();
        let e = evs.clone();
        (
            Arc::new(move |b| { f.lock().unwrap().push(b); true }),
            frames,
            Arc::new(move |ev| e.lock().unwrap().push(ev)),
            evs,
        )
    }

    #[test]
    fn test_handle_event_raw_image_marks_dirty_and_forces_alpha() {
        let (fs, _frames, es, _evs) = sinks();
        let mut s = test_session();
        let rect = ::vnc::Rect { x: 1, y: 1, width: 1, height: 1 };
        handle_event(VncEvent::RawImage(rect, vec![10, 20, 30, 0]), &mut s, &fs, &es).unwrap();
        assert_eq!(s.fb.region(&Rect::new(1, 1, 1, 1)), vec![10, 20, 30, 255]);
        assert_eq!(s.dirty.take(), vec![Rect::new(1, 1, 1, 1)]);
    }

    #[test]
    fn test_handle_event_rejects_rect_outside_framebuffer() {
        let (fs, _f, es, _e) = sinks();
        let mut s = test_session();
        let rect = ::vnc::Rect { x: 3, y: 3, width: 2, height: 2 };
        assert!(handle_event(VncEvent::RawImage(rect, vec![0; 16]), &mut s, &fs, &es).is_err());
    }

    #[test]
    fn test_handle_event_resolution_cursor_text_and_error() {
        let (fs, frames, es, evs) = sinks();
        let mut s = Session { fb: Framebuffer::default(), dirty: DirtyCoalescer::new(), buttons: 0 };
        handle_event(VncEvent::SetResolution((8u16, 6u16).into()), &mut s, &fs, &es).unwrap();
        assert_eq!((s.fb.width, s.fb.height), (8, 6));
        assert_eq!(frames.lock().unwrap()[0][0], frame::KIND_RESIZE);

        let cur = ::vnc::Rect { x: 1, y: 2, width: 1, height: 1 };
        handle_event(VncEvent::SetCursor(cur, vec![1, 2, 3, 4]), &mut s, &fs, &es).unwrap();
        assert_eq!(frames.lock().unwrap()[1][0], frame::KIND_CURSOR);

        handle_event(VncEvent::Text("hola".into()), &mut s, &fs, &es).unwrap();
        assert_eq!(evs.lock().unwrap()[0], SessionEvent::Clipboard { text: "hola".into() });

        assert!(matches!(
            handle_event(VncEvent::Error("boom".into()), &mut s, &fs, &es),
            Err(RemoteDesktopError::SessionClosed)
        ));
        assert!(handle_event(VncEvent::SetResolution((0u16, 0u16).into()), &mut s, &fs, &es).is_err());
    }

    #[test]
    fn test_flush_stops_when_frontend_is_gone() {
        let mut s = test_session();
        s.dirty.push(Rect::new(0, 0, 2, 2));
        let gone: FrameSink = Arc::new(|_| false);
        assert!(!flush(&mut s, &gone));
    }

    // ---- Servidor RFB 3.8 simulado -------------------------------------------------

    async fn rfb_handshake(s: &mut DuplexStream, security: u8) {
        s.write_all(b"RFB 003.008\n").await.unwrap();
        let mut ver = [0u8; 12];
        s.read_exact(&mut ver).await.unwrap();
        s.write_all(&[1, security]).await.unwrap();
        let mut chosen = [0u8; 1];
        s.read_exact(&mut chosen).await.unwrap();
    }

    async fn rfb_server_init(s: &mut DuplexStream, w: u16, h: u16) {
        let mut shared = [0u8; 1];
        s.read_exact(&mut shared).await.unwrap();
        s.write_all(&w.to_be_bytes()).await.unwrap();
        s.write_all(&h.to_be_bytes()).await.unwrap();
        // rgba: 32bpp, depth 24, little-endian, true-color, max 255, shifts r=0 g=8 b=16
        s.write_all(&[32, 24, 0, 1, 0, 255, 0, 255, 0, 255, 0, 8, 16, 0, 0, 0]).await.unwrap();
        s.write_all(&4u32.to_be_bytes()).await.unwrap();
        s.write_all(b"mock").await.unwrap();
    }

    async fn rfb_raw_update(s: &mut DuplexStream, x: u16, y: u16, w: u16, h: u16, px: &[u8]) {
        let mut msg = vec![0u8, 0, 0, 1];
        for v in [x, y, w, h] {
            msg.extend_from_slice(&v.to_be_bytes());
        }
        msg.extend_from_slice(&0i32.to_be_bytes()); // Raw
        msg.extend_from_slice(px);
        s.write_all(&msg).await.unwrap();
    }

    #[tokio::test]
    async fn test_vnc_session_receives_rect_and_closes_on_command() {
        let (client_side, mut server) = tokio::io::duplex(1 << 16);
        tokio::spawn(async move {
            rfb_handshake(&mut server, 1).await;
            let mut res = [0u8; 4]; // SecurityResult OK
            res.copy_from_slice(&0u32.to_be_bytes());
            server.write_all(&res).await.unwrap();
            rfb_server_init(&mut server, 4, 4).await;
            rfb_raw_update(&mut server, 0, 0, 1, 1, &[255, 0, 0, 0]).await;
            // mantener la conexión abierta
            let mut sink = [0u8; 256];
            while server.read(&mut sink).await.map(|n| n > 0).unwrap_or(false) {}
        });

        let (fs, frames, es, evs) = sinks();
        let (tx, rx) = mpsc::channel(8);
        let task = tokio::spawn(run(client_side, None, rx, fs, es));

        let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
        loop {
            let has_rect = frames.lock().unwrap().iter().any(|f| f[0] == frame::KIND_RECT && f.len() > frame::HEADER_LEN);
            if has_rect && frames.lock().unwrap().iter().any(|f| f[0] == frame::KIND_RESIZE) {
                break;
            }
            assert!(tokio::time::Instant::now() < deadline, "no llegaron frames a tiempo");
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        // el último rect que cubre (0,0) debe tener el píxel rojo opaco
        let pixel_ok = frames.lock().unwrap().iter().rev().any(|f| {
            let d = frame::decode(f).unwrap();
            d.kind == frame::KIND_RECT && d.rect.x == 0 && d.rect.y == 0 && d.payload.len() >= 4 && d.payload[..4] == [255, 0, 0, 255]
        });
        assert!(pixel_ok, "el píxel rojo opaco no llegó al frontend");

        tx.send(SessionCommand::Close).await.unwrap();
        let res = tokio::time::timeout(Duration::from_secs(5), task).await.unwrap().unwrap();
        assert!(res.is_ok());
        let states: Vec<String> = evs.lock().unwrap().iter().filter_map(|e| match e {
            SessionEvent::State { state } => Some(state.clone()),
            _ => None,
        }).collect();
        assert_eq!(states, vec!["connecting", "connected", "disconnected"]);
    }

    #[tokio::test]
    async fn test_vnc_auth_required_without_password_fails_with_auth_error() {
        let (client_side, mut server) = tokio::io::duplex(1 << 16);
        tokio::spawn(async move {
            rfb_handshake(&mut server, 2).await; // VNC auth
            server.write_all(&[7u8; 16]).await.unwrap(); // desafío
            let mut sink = [0u8; 64];
            let _ = server.read(&mut sink).await;
        });
        let (fs, _f, es, evs) = sinks();
        let (_tx, rx) = mpsc::channel(1);
        let res = tokio::time::timeout(Duration::from_secs(5), run(client_side, None, rx, fs, es)).await.unwrap();
        assert!(matches!(res, Err(RemoteDesktopError::Authentication(_))));
        assert!(evs.lock().unwrap().iter().any(|e| matches!(e, SessionEvent::Error { .. })));
    }

    #[tokio::test]
    async fn test_vnc_server_disconnect_reports_disconnected() {
        let (client_side, mut server) = tokio::io::duplex(1 << 16);
        tokio::spawn(async move {
            rfb_handshake(&mut server, 1).await;
            server.write_all(&0u32.to_be_bytes()).await.unwrap();
            rfb_server_init(&mut server, 2, 2).await;
            // Deja que el cliente termine su arranque y cierra con la sesión ya establecida.
            let mut sink = [0u8; 256];
            let _ = tokio::time::timeout(Duration::from_millis(300), server.read(&mut sink)).await;
            tokio::time::sleep(Duration::from_millis(100)).await;
            // drop → cierre remoto
        });
        let (fs, _f, es, evs) = sinks();
        let (_tx, rx) = mpsc::channel(1);
        let res = tokio::time::timeout(Duration::from_secs(5), run(client_side, None, rx, fs, es)).await.unwrap();
        assert!(res.is_ok(), "resultado: {:?}", res);
        let last = evs.lock().unwrap().last().cloned();
        assert_eq!(last, Some(SessionEvent::State { state: "disconnected".into() }));
    }

    #[tokio::test]
    async fn test_vnc_garbage_server_fails_without_panicking() {
        let (client_side, mut server) = tokio::io::duplex(1 << 12);
        tokio::spawn(async move {
            let _ = server.write_all(b"HTTP/1.1 200 OK\r\n\r\n").await;
        });
        let (fs, _f, es, _e) = sinks();
        let (_tx, rx) = mpsc::channel(1);
        let res = tokio::time::timeout(Duration::from_secs(5), run(client_side, None, rx, fs, es)).await.unwrap();
        assert!(res.is_err());
    }
}
