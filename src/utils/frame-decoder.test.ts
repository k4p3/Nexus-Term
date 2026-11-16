import { describe, it, expect } from "vitest";
import { decodeFrame } from "./frame-decoder";

function frame(kind: number, x: number, y: number, w: number, h: number, payload: number[] = []): Uint8Array {
  const buf = new Uint8Array(9 + payload.length);
  const v = new DataView(buf.buffer);
  v.setUint8(0, kind);
  v.setUint16(1, x, true);
  v.setUint16(3, y, true);
  v.setUint16(5, w, true);
  v.setUint16(7, h, true);
  buf.set(payload, 9);
  return buf;
}

describe("decodeFrame", () => {
  it("decodes a rect with RGBA payload", () => {
    const px = [1, 2, 3, 255, 4, 5, 6, 255];
    const f = decodeFrame(frame(0, 10, 20, 2, 1, px));
    expect(f).toMatchObject({ kind: 0, x: 10, y: 20, w: 2, h: 1 });
    expect(Array.from(f.payload)).toEqual(px);
  });

  it("accepts ArrayBuffer input and offset views", () => {
    const f = frame(1, 0, 0, 1920, 1080);
    expect(decodeFrame(f.buffer as ArrayBuffer)).toMatchObject({ kind: 1, w: 1920, h: 1080 });
    const padded = new Uint8Array(4 + f.length);
    padded.set(f, 4);
    expect(decodeFrame(padded.subarray(4)).w).toBe(1920);
  });

  it("decodes cursor frames with hotspot", () => {
    const f = decodeFrame(frame(2, 3, 4, 1, 1, [9, 9, 9, 9]));
    expect(f).toMatchObject({ kind: 2, x: 3, y: 4 });
  });

  it("rejects malformed frames", () => {
    expect(() => decodeFrame(new Uint8Array(3))).toThrow();
    expect(() => decodeFrame(frame(9, 0, 0, 0, 0))).toThrow();
    expect(() => decodeFrame(frame(0, 0, 0, 2, 2, [1, 2, 3]))).toThrow();
    expect(() => decodeFrame(frame(1, 0, 0, 10, 10, [1]))).toThrow();
  });
});
