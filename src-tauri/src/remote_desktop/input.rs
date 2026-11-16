//! Eventos de entrada enviados por el frontend y su validación.

use super::error::RemoteDesktopError;
use serde::{Deserialize, Serialize};

pub const MAX_COORD: u16 = 8192;
pub const MAX_CLIPBOARD_BYTES: usize = 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum InputEvent {
    /// Tecla física: `scancode` PC/AT (set 1), `extended` para prefijo E0.
    /// `keysym` (X11) es opcional y lo usa VNC para respetar la distribución de teclado.
    Key {
        scancode: u16,
        extended: bool,
        down: bool,
        #[serde(default)]
        keysym: Option<u32>,
    },
    /// Posición absoluta y máscara de botones (bit0 izq, bit1 central, bit2 der).
    Pointer { x: u16, y: u16, buttons: u8 },
    /// Rueda: `dy` > 0 hacia arriba, `dx` > 0 hacia la derecha (en "notches").
    Wheel { x: u16, y: u16, dx: i16, dy: i16 },
}

impl InputEvent {
    pub fn validate(&self) -> Result<(), RemoteDesktopError> {
        match self {
            InputEvent::Key { scancode, .. } if *scancode == 0 || *scancode > 0xFF => Err(
                RemoteDesktopError::InvalidInput("scancode fuera de rango".into()),
            ),
            InputEvent::Pointer { x, y, buttons } => {
                if *x > MAX_COORD || *y > MAX_COORD {
                    return Err(RemoteDesktopError::InvalidInput("coordenadas fuera de rango".into()));
                }
                if *buttons > 0b111 {
                    return Err(RemoteDesktopError::InvalidInput("máscara de botones inválida".into()));
                }
                Ok(())
            }
            InputEvent::Wheel { x, y, .. } if *x > MAX_COORD || *y > MAX_COORD => Err(
                RemoteDesktopError::InvalidInput("coordenadas fuera de rango".into()),
            ),
            _ => Ok(()),
        }
    }
}

pub fn validate_clipboard_text(text: &str) -> Result<(), RemoteDesktopError> {
    if text.len() > MAX_CLIPBOARD_BYTES {
        return Err(RemoteDesktopError::InvalidInput(
            "El texto del portapapeles supera 1 MiB".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_input_event_serde_tagged() {
        let ev: InputEvent =
            serde_json::from_str(r#"{"type":"key","scancode":30,"extended":false,"down":true}"#).unwrap();
        assert_eq!(ev, InputEvent::Key { scancode: 30, extended: false, down: true, keysym: None });
        let ev: InputEvent =
            serde_json::from_str(r#"{"type":"pointer","x":10,"y":20,"buttons":1}"#).unwrap();
        assert!(ev.validate().is_ok());
    }

    #[test]
    fn test_unknown_event_type_is_rejected() {
        assert!(serde_json::from_str::<InputEvent>(r#"{"type":"evil"}"#).is_err());
    }

    #[test]
    fn test_validation_rejects_out_of_range() {
        assert!(InputEvent::Key { scancode: 0, extended: false, down: true, keysym: None }.validate().is_err());
        assert!(InputEvent::Key { scancode: 0x100, extended: false, down: true, keysym: None }.validate().is_err());
        assert!(InputEvent::Pointer { x: MAX_COORD + 1, y: 0, buttons: 0 }.validate().is_err());
        assert!(InputEvent::Pointer { x: 0, y: 0, buttons: 8 }.validate().is_err());
        assert!(InputEvent::Wheel { x: 0, y: MAX_COORD + 1, dx: 0, dy: 1 }.validate().is_err());
        assert!(InputEvent::Wheel { x: 5, y: 5, dx: 0, dy: -1 }.validate().is_ok());
    }

    #[test]
    fn test_clipboard_limit() {
        assert!(validate_clipboard_text("hola").is_ok());
        assert!(validate_clipboard_text(&"a".repeat(MAX_CLIPBOARD_BYTES + 1)).is_err());
    }
}
