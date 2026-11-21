//! Formato binario de frames para escritorio remoto y coalescencia de rectángulos sucios.
//!
//! Cabecera (little-endian): `[u8 kind][u16 x][u16 y][u16 w][u16 h]` seguida del payload.
//! - `kind = 0` (Rect): payload RGBA de `w*h*4` bytes.
//! - `kind = 1` (Resize): sin payload; `w`/`h` son el nuevo tamaño del framebuffer.
//! - `kind = 2` (Cursor): `x`/`y` = hotspot; payload RGBA de `w*h*4` bytes.

use super::error::RemoteDesktopError;

pub const HEADER_LEN: usize = 9;
pub const KIND_RECT: u8 = 0;
pub const KIND_RESIZE: u8 = 1;
pub const KIND_CURSOR: u8 = 2;

/// Tamaño máximo admitido de framebuffer por lado (protege frente a servidores maliciosos).
pub const MAX_DIMENSION: u16 = 8192;
/// Si se acumulan más rectángulos que esto, se funden en su caja envolvente.
pub const MAX_PENDING_RECTS: usize = 32;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rect {
    pub x: u16,
    pub y: u16,
    pub w: u16,
    pub h: u16,
}

impl Rect {
    pub fn new(x: u16, y: u16, w: u16, h: u16) -> Self {
        Self { x, y, w, h }
    }

    pub fn right(&self) -> u32 {
        self.x as u32 + self.w as u32
    }

    pub fn bottom(&self) -> u32 {
        self.y as u32 + self.h as u32
    }

    pub fn is_empty(&self) -> bool {
        self.w == 0 || self.h == 0
    }

    /// `true` si los rectángulos se solapan o se tocan por algún borde.
    pub fn touches(&self, other: &Rect) -> bool {
        self.x as u32 <= other.right()
            && other.x as u32 <= self.right()
            && self.y as u32 <= other.bottom()
            && other.y as u32 <= self.bottom()
    }

    /// Caja envolvente de ambos rectángulos.
    pub fn union(&self, other: &Rect) -> Rect {
        let x = self.x.min(other.x);
        let y = self.y.min(other.y);
        let right = self.right().max(other.right());
        let bottom = self.bottom().max(other.bottom());
        Rect {
            x,
            y,
            w: (right - x as u32) as u16,
            h: (bottom - y as u32) as u16,
        }
    }

    pub fn area(&self) -> u64 {
        self.w as u64 * self.h as u64
    }
}

fn write_header(buf: &mut Vec<u8>, kind: u8, x: u16, y: u16, w: u16, h: u16) {
    buf.push(kind);
    buf.extend_from_slice(&x.to_le_bytes());
    buf.extend_from_slice(&y.to_le_bytes());
    buf.extend_from_slice(&w.to_le_bytes());
    buf.extend_from_slice(&h.to_le_bytes());
}

/// Codifica un rectángulo RGBA. `rgba.len()` debe ser exactamente `w*h*4`.
pub fn encode_rect(rect: &Rect, rgba: &[u8]) -> Result<Vec<u8>, RemoteDesktopError> {
    encode_with_payload(KIND_RECT, rect, rgba)
}

/// Codifica la imagen del cursor remoto (`x`,`y` = hotspot).
pub fn encode_cursor(hotspot: (u16, u16), w: u16, h: u16, rgba: &[u8]) -> Result<Vec<u8>, RemoteDesktopError> {
    encode_with_payload(KIND_CURSOR, &Rect::new(hotspot.0, hotspot.1, w, h), rgba)
}

fn encode_with_payload(kind: u8, rect: &Rect, rgba: &[u8]) -> Result<Vec<u8>, RemoteDesktopError> {
    if rect.w > MAX_DIMENSION || rect.h > MAX_DIMENSION {
        return Err(RemoteDesktopError::Protocol(
            "Rectangle dimensions out of bounds".into(),
        ));
    }
    let expected = rect.w as usize * rect.h as usize * 4;
    if rgba.len() != expected {
        return Err(RemoteDesktopError::Protocol(format!(
            "Payload RGBA inconsistente: {} bytes, esperados {}",
            rgba.len(),
            expected
        )));
    }
    let mut buf = Vec::with_capacity(HEADER_LEN + rgba.len());
    write_header(&mut buf, kind, rect.x, rect.y, rect.w, rect.h);
    buf.extend_from_slice(rgba);
    Ok(buf)
}

/// Codifica un cambio de tamaño del framebuffer.
pub fn encode_resize(w: u16, h: u16) -> Result<Vec<u8>, RemoteDesktopError> {
    if w == 0 || h == 0 || w > MAX_DIMENSION || h > MAX_DIMENSION {
        return Err(RemoteDesktopError::Protocol(format!(
            "Invalid framebuffer size: {}x{}",
            w, h
        )));
    }
    let mut buf = Vec::with_capacity(HEADER_LEN);
    write_header(&mut buf, KIND_RESIZE, 0, 0, w, h);
    Ok(buf)
}

/// Frame decodificado (usado en pruebas y para validar la cabecera).
#[derive(Debug, PartialEq, Eq)]
pub struct DecodedFrame<'a> {
    pub kind: u8,
    pub rect: Rect,
    pub payload: &'a [u8],
}

pub fn decode(buf: &[u8]) -> Result<DecodedFrame<'_>, RemoteDesktopError> {
    if buf.len() < HEADER_LEN {
        return Err(RemoteDesktopError::Protocol("Frame truncado".into()));
    }
    let kind = buf[0];
    let rd = |o: usize| u16::from_le_bytes([buf[o], buf[o + 1]]);
    let rect = Rect::new(rd(1), rd(3), rd(5), rd(7));
    let payload = &buf[HEADER_LEN..];
    let expects_payload = kind == KIND_RECT || kind == KIND_CURSOR;
    if kind > KIND_CURSOR {
        return Err(RemoteDesktopError::Protocol(format!("Tipo de frame desconocido: {}", kind)));
    }
    if expects_payload && payload.len() != rect.w as usize * rect.h as usize * 4 {
        return Err(RemoteDesktopError::Protocol("Payload with inconsistent size".into()));
    }
    if !expects_payload && !payload.is_empty() {
        return Err(RemoteDesktopError::Protocol("Resize no admite payload".into()));
    }
    Ok(DecodedFrame { kind, rect, payload })
}

/// Comprueba que un rectángulo recibido del servidor cabe en el framebuffer actual.
pub fn validate_within(rect: &Rect, fb_w: u16, fb_h: u16) -> Result<(), RemoteDesktopError> {
    if rect.is_empty() || rect.right() > fb_w as u32 || rect.bottom() > fb_h as u32 {
        return Err(RemoteDesktopError::Protocol(format!(
            "Rectangle {}x{}@{},{} outside the framebuffer {}x{}",
            rect.w, rect.h, rect.x, rect.y, fb_w, fb_h
        )));
    }
    Ok(())
}

/// Acumula rectángulos sucios entre envíos (backpressure): fusiona los que se tocan y,
/// si hay demasiados, los reduce a una única caja envolvente. La memoria queda acotada.
#[derive(Debug, Default)]
pub struct DirtyCoalescer {
    rects: Vec<Rect>,
}

impl DirtyCoalescer {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_empty(&self) -> bool {
        self.rects.is_empty()
    }

    pub fn len(&self) -> usize {
        self.rects.len()
    }

    pub fn push(&mut self, rect: Rect) {
        if rect.is_empty() {
            return;
        }
        let mut current = rect;
        // Fusionar con todo lo que toque, repitiendo hasta estabilizar.
        loop {
            let before = self.rects.len();
            let mut merged = false;
            let mut i = 0;
            while i < self.rects.len() {
                if self.rects[i].touches(&current) {
                    current = current.union(&self.rects.swap_remove(i));
                    merged = true;
                } else {
                    i += 1;
                }
            }
            if !merged || self.rects.len() == before {
                break;
            }
        }
        self.rects.push(current);

        if self.rects.len() > MAX_PENDING_RECTS {
            let all = self.take();
            if let Some(first) = all.first().cloned() {
                let bbox = all.iter().skip(1).fold(first, |acc, r| acc.union(r));
                self.rects.push(bbox);
            }
        }
    }

    /// Devuelve y vacía los rectángulos pendientes, ordenados por posición.
    pub fn take(&mut self) -> Vec<Rect> {
        let mut out = std::mem::take(&mut self.rects);
        out.sort_by_key(|r| (r.y, r.x));
        out
    }
}

/// Copia la subregión `rect` de un framebuffer RGBA completo.
pub fn extract_region(fb: &[u8], fb_w: u16, rect: &Rect) -> Vec<u8> {
    let stride = fb_w as usize * 4;
    let row_len = rect.w as usize * 4;
    let mut out = Vec::with_capacity(row_len * rect.h as usize);
    for row in 0..rect.h as usize {
        let start = (rect.y as usize + row) * stride + rect.x as usize * 4;
        out.extend_from_slice(&fb[start..start + row_len]);
    }
    out
}


/// Framebuffer RGBA local (alpha siempre opaco) sobre el que se componen las actualizaciones.
#[derive(Debug, Default)]
pub struct Framebuffer {
    pub width: u16,
    pub height: u16,
    pub data: Vec<u8>,
}

impl Framebuffer {
    /// Reasigna el framebuffer a negro opaco. Valida los límites.
    pub fn resize(&mut self, w: u16, h: u16) -> Result<(), RemoteDesktopError> {
        if w == 0 || h == 0 || w > MAX_DIMENSION || h > MAX_DIMENSION {
            return Err(RemoteDesktopError::Protocol(format!(
                "Invalid framebuffer size: {}x{}",
                w, h
            )));
        }
        self.width = w;
        self.height = h;
        self.data = [0u8, 0, 0, 255].repeat(w as usize * h as usize);
        Ok(())
    }

    /// Copia píxeles RGBA en `rect` forzando alpha = 255 (muchos servidores envían 0 en el byte de relleno).
    pub fn blit_opaque(&mut self, rect: &Rect, rgba: &[u8]) -> Result<(), RemoteDesktopError> {
        validate_within(rect, self.width, self.height)?;
        let row_len = rect.w as usize * 4;
        if rgba.len() != row_len * rect.h as usize {
            return Err(RemoteDesktopError::Protocol("Image data with inconsistent size".into()));
        }
        let stride = self.width as usize * 4;
        for row in 0..rect.h as usize {
            let dst = (rect.y as usize + row) * stride + rect.x as usize * 4;
            let src = row * row_len;
            self.data[dst..dst + row_len].copy_from_slice(&rgba[src..src + row_len]);
            for alpha in self.data[dst..dst + row_len].iter_mut().skip(3).step_by(4) {
                *alpha = 255;
            }
        }
        Ok(())
    }

    /// Copia la región `src` a `dst` (mismo tamaño), seguro ante solapamiento.
    pub fn copy_region(&mut self, dst: &Rect, src: &Rect) -> Result<(), RemoteDesktopError> {
        if dst.w != src.w || dst.h != src.h {
            return Err(RemoteDesktopError::Protocol("CopyRect with mismatched sizes".into()));
        }
        validate_within(dst, self.width, self.height)?;
        validate_within(src, self.width, self.height)?;
        let tmp = extract_region(&self.data, self.width, src);
        self.blit_opaque(dst, &tmp)
    }

    pub fn region(&self, rect: &Rect) -> Vec<u8> {
        extract_region(&self.data, self.width, rect)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode_rect_roundtrip() {
        let rect = Rect::new(10, 20, 2, 2);
        let rgba: Vec<u8> = (0..16).collect();
        let buf = encode_rect(&rect, &rgba).unwrap();
        assert_eq!(buf.len(), HEADER_LEN + 16);
        let d = decode(&buf).unwrap();
        assert_eq!(d.kind, KIND_RECT);
        assert_eq!(d.rect, rect);
        assert_eq!(d.payload, rgba.as_slice());
    }

    #[test]
    fn test_header_is_little_endian() {
        let buf = encode_rect(&Rect::new(0x0102, 0x0304, 1, 1), &[0, 0, 0, 0]).unwrap();
        assert_eq!(&buf[..5], &[KIND_RECT, 0x02, 0x01, 0x04, 0x03]);
    }

    #[test]
    fn test_encode_rect_rejects_wrong_payload_size() {
        assert!(encode_rect(&Rect::new(0, 0, 2, 2), &[0u8; 15]).is_err());
        assert!(encode_rect(&Rect::new(0, 0, 2, 2), &[0u8; 17]).is_err());
    }

    #[test]
    fn test_encode_rect_rejects_huge_dimensions() {
        assert!(encode_rect(&Rect::new(0, 0, MAX_DIMENSION + 1, 1), &[]).is_err());
    }

    #[test]
    fn test_resize_and_cursor_frames() {
        let rb = encode_resize(1920, 1080).unwrap();
        let r = decode(&rb).unwrap();
        assert_eq!(r.kind, KIND_RESIZE);
        assert_eq!((r.rect.w, r.rect.h), (1920, 1080));
        assert!(r.payload.is_empty());

        let cb = encode_cursor((3, 4), 1, 1, &[1, 2, 3, 4]).unwrap();
        let c = decode(&cb).unwrap();
        assert_eq!(c.kind, KIND_CURSOR);
        assert_eq!((c.rect.x, c.rect.y), (3, 4));
    }

    #[test]
    fn test_resize_rejects_invalid_sizes() {
        assert!(encode_resize(0, 100).is_err());
        assert!(encode_resize(100, 0).is_err());
        assert!(encode_resize(MAX_DIMENSION + 1, 10).is_err());
    }

    #[test]
    fn test_decode_rejects_malformed_frames() {
        assert!(decode(&[0, 1, 2]).is_err());
        assert!(decode(&[9, 0, 0, 0, 0, 0, 0, 0, 0]).is_err());
        let mut bad = encode_rect(&Rect::new(0, 0, 1, 1), &[0; 4]).unwrap();
        bad.pop();
        assert!(decode(&bad).is_err());
        let mut resize = encode_resize(10, 10).unwrap();
        resize.push(0);
        assert!(decode(&resize).is_err());
    }

    #[test]
    fn test_validate_within_framebuffer() {
        assert!(validate_within(&Rect::new(0, 0, 100, 100), 100, 100).is_ok());
        assert!(validate_within(&Rect::new(1, 0, 100, 100), 100, 100).is_err());
        assert!(validate_within(&Rect::new(0, 0, 0, 10), 100, 100).is_err());
        assert!(validate_within(&Rect::new(65535, 65535, 1, 1), 100, 100).is_err());
    }

    #[test]
    fn test_rect_union_and_touches() {
        let a = Rect::new(0, 0, 10, 10);
        let b = Rect::new(10, 0, 5, 5); // adyacente
        let c = Rect::new(50, 50, 5, 5);
        assert!(a.touches(&b));
        assert!(!a.touches(&c));
        assert_eq!(a.union(&b), Rect::new(0, 0, 15, 10));
        assert_eq!(a.union(&c), Rect::new(0, 0, 55, 55));
    }

    #[test]
    fn test_coalescer_merges_overlapping_and_keeps_disjoint() {
        let mut c = DirtyCoalescer::new();
        c.push(Rect::new(0, 0, 10, 10));
        c.push(Rect::new(5, 5, 10, 10));
        c.push(Rect::new(100, 100, 4, 4));
        assert_eq!(c.len(), 2);
        let out = c.take();
        assert_eq!(out, vec![Rect::new(0, 0, 15, 15), Rect::new(100, 100, 4, 4)]);
        assert!(c.is_empty());
    }

    #[test]
    fn test_coalescer_chain_merge_via_bridge_rect() {
        let mut c = DirtyCoalescer::new();
        c.push(Rect::new(0, 0, 10, 10));
        c.push(Rect::new(30, 0, 10, 10));
        c.push(Rect::new(8, 0, 24, 10)); // une las dos
        assert_eq!(c.take(), vec![Rect::new(0, 0, 40, 10)]);
    }

    #[test]
    fn test_coalescer_ignores_empty_and_bounds_memory() {
        let mut c = DirtyCoalescer::new();
        c.push(Rect::new(0, 0, 0, 5));
        assert!(c.is_empty());
        // Rectángulos disjuntos: no puede superar el límite.
        for i in 0..200u16 {
            c.push(Rect::new(i * 20, 0, 5, 5));
            assert!(c.len() <= MAX_PENDING_RECTS);
        }
        assert!(!c.is_empty());
    }

    #[test]
    fn test_extract_region_copies_correct_pixels() {
        // Framebuffer 4x2; píxel i = [i,i,i,i]
        let fb: Vec<u8> = (0..8u8).flat_map(|i| [i, i, i, i]).collect();
        let region = extract_region(&fb, 4, &Rect::new(1, 1, 2, 1));
        assert_eq!(region, vec![5, 5, 5, 5, 6, 6, 6, 6]);
    }

    #[test]
    fn test_framebuffer_resize_blit_and_alpha() {
        let mut fb = Framebuffer::default();
        assert!(fb.resize(0, 10).is_err());
        fb.resize(4, 2).unwrap();
        assert_eq!(&fb.data[..4], &[0, 0, 0, 255]);
        // alpha 0 de entrada debe quedar opaco
        fb.blit_opaque(&Rect::new(1, 0, 2, 1), &[9, 8, 7, 0, 6, 5, 4, 0]).unwrap();
        assert_eq!(fb.region(&Rect::new(1, 0, 2, 1)), vec![9, 8, 7, 255, 6, 5, 4, 255]);
    }

    #[test]
    fn test_framebuffer_rejects_out_of_bounds_and_bad_sizes() {
        let mut fb = Framebuffer::default();
        fb.resize(4, 4).unwrap();
        assert!(fb.blit_opaque(&Rect::new(3, 3, 2, 2), &[0; 16]).is_err());
        assert!(fb.blit_opaque(&Rect::new(0, 0, 2, 2), &[0; 15]).is_err());
        assert!(fb.copy_region(&Rect::new(0, 0, 2, 2), &Rect::new(0, 0, 3, 2)).is_err());
    }

    #[test]
    fn test_framebuffer_copy_region_handles_overlap() {
        let mut fb = Framebuffer::default();
        fb.resize(4, 1).unwrap();
        let px: Vec<u8> = (1..=4u8).flat_map(|i| [i, i, i, 255]).collect();
        fb.blit_opaque(&Rect::new(0, 0, 4, 1), &px).unwrap();
        fb.copy_region(&Rect::new(1, 0, 3, 1), &Rect::new(0, 0, 3, 1)).unwrap();
        let out: Vec<u8> = fb.data.chunks(4).map(|p| p[0]).collect();
        assert_eq!(out, vec![1, 1, 2, 3]);
    }
}
