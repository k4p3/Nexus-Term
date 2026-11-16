import { describe, it, expect } from "vitest";
import { ReplayBuffer } from "./replay-buffer";

const bytes = (n: number, fill = 1) => new Uint8Array(n).fill(fill);

describe("ReplayBuffer", () => {
  it("starts empty", () => {
    const b = new ReplayBuffer();
    expect(b.span).toBeNull();
    expect(b.bytes).toBe(0);
    expect(b.range(0, 1e12)).toEqual([]);
  });

  it("stores chunks in order and reports span and size", () => {
    const b = new ReplayBuffer();
    b.push(100, bytes(3, 1));
    b.push(200, bytes(2, 2));
    expect(b.span).toEqual([100, 200]);
    expect(b.bytes).toBe(5);
    expect(b.size).toBe(2);
  });

  it("ignores empty chunks", () => {
    const b = new ReplayBuffer();
    b.push(1, new Uint8Array(0));
    expect(b.span).toBeNull();
  });

  it("range returns only chunks inside the inclusive interval", () => {
    const b = new ReplayBuffer();
    for (const t of [10, 20, 30, 40]) b.push(t, bytes(1, t));
    expect(b.range(20, 30).map((c) => c[0])).toEqual([20, 30]);
    expect(b.range(0, 5)).toEqual([]);
    expect(b.range(41, 99)).toEqual([]);
    expect(b.range(0, 1e9)).toHaveLength(4);
  });

  it("discards the oldest chunks when the time window is exceeded", () => {
    const b = new ReplayBuffer(1000, 1e9);
    b.push(0, bytes(1, 1));
    b.push(500, bytes(1, 2));
    b.push(1200, bytes(1, 3)); // 1200 - 0 > 1000 -> descarta el primero
    expect(b.span).toEqual([500, 1200]);
    b.push(2000, bytes(1, 4)); // descarta también el de 500
    expect(b.span).toEqual([1200, 2000]);
    expect(b.bytes).toBe(2);
  });

  it("discards the oldest chunks when the size limit is exceeded", () => {
    const b = new ReplayBuffer(1e9, 10);
    b.push(1, bytes(4, 1));
    b.push(2, bytes(4, 2));
    b.push(3, bytes(4, 3)); // 12 > 10 -> descarta el primero
    expect(b.bytes).toBe(8);
    expect(b.range(0, 99).map((c) => c[0])).toEqual([2, 3]);
  });

  it("keeps only the tail of a single oversized chunk", () => {
    const b = new ReplayBuffer(1e9, 4);
    const big = new Uint8Array([1, 2, 3, 4, 5, 6]);
    b.push(1, big);
    expect(b.bytes).toBe(4);
    expect(Array.from(b.range(0, 9)[0])).toEqual([3, 4, 5, 6]);
  });

  it("never drops the newest chunk", () => {
    const b = new ReplayBuffer(0, 1e9);
    b.push(0, bytes(1));
    b.push(5000, bytes(1, 9));
    expect(b.size).toBe(1);
    expect(b.span).toEqual([5000, 5000]);
  });

  it("stays bounded and consistent after many pushes (compaction)", () => {
    const b = new ReplayBuffer(1e9, 1000);
    for (let i = 0; i < 5000; i++) b.push(i, bytes(10, i % 255));
    expect(b.bytes).toBeLessThanOrEqual(1000);
    expect(b.size).toBe(100);
    expect(b.span).toEqual([4900, 4999]);
    expect(b.range(4990, 4999)).toHaveLength(10);
  });

  it("clear() empties the buffer and allows reuse", () => {
    const b = new ReplayBuffer();
    b.push(1, bytes(5));
    b.clear();
    expect(b.span).toBeNull();
    expect(b.bytes).toBe(0);
    expect(b.range(0, 99)).toEqual([]);
    b.push(2, bytes(1));
    expect(b.size).toBe(1);
  });
});
