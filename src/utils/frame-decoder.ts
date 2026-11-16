import { type DecodedFrame, FRAME_KIND_CURSOR, FRAME_KIND_RECT, FRAME_KIND_RESIZE } from "../types/remote-desktop";

export const FRAME_HEADER_LEN = 9;

/**
 * Decodifica un frame binario del backend:
 * `[u8 kind][u16 x][u16 y][u16 w][u16 h][payload]` (little-endian).
 * Lanza un Error si el frame está truncado o es inconsistente.
 */
export function decodeFrame(buf: ArrayBuffer | Uint8Array): DecodedFrame {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.byteLength < FRAME_HEADER_LEN) throw new Error("Frame truncado");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kind = view.getUint8(0);
  const x = view.getUint16(1, true);
  const y = view.getUint16(3, true);
  const w = view.getUint16(5, true);
  const h = view.getUint16(7, true);
  const payload = bytes.subarray(FRAME_HEADER_LEN);

  if (kind === FRAME_KIND_RECT || kind === FRAME_KIND_CURSOR) {
    if (payload.byteLength !== w * h * 4) throw new Error("Payload inconsistente");
  } else if (kind === FRAME_KIND_RESIZE) {
    if (payload.byteLength !== 0) throw new Error("Resize no admite payload");
  } else {
    throw new Error(`Tipo de frame desconocido: ${kind}`);
  }
  return { kind, x, y, w, h, payload };
}
