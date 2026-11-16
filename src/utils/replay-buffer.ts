// Búfer circular de salida con marca de tiempo para Instant Replay.
// Vive SOLO en memoria: nunca se serializa ni se escribe en disco.

export interface ReplayChunk {
  ts: number;
  data: Uint8Array;
}

export const REPLAY_MAX_MS = 5 * 60 * 1000;
export const REPLAY_MAX_BYTES = 8 * 1024 * 1024;

export class ReplayBuffer {
  private chunks: ReplayChunk[] = [];
  private head = 0; // índice del chunk más antiguo (evita O(n) en cada descarte)
  private totalBytes = 0;

  constructor(
    private readonly maxMs: number = REPLAY_MAX_MS,
    private readonly maxBytes: number = REPLAY_MAX_BYTES,
  ) {}

  push(ts: number, data: Uint8Array): void {
    if (data.length === 0) return;
    // Un único fragmento mayor que el límite conserva solo su cola.
    const kept = data.length > this.maxBytes ? data.subarray(data.length - this.maxBytes) : data;
    this.chunks.push({ ts, data: kept });
    this.totalBytes += kept.length;
    this.evict(ts);
  }

  private evict(now: number): void {
    while (this.head < this.chunks.length - 1 && (this.totalBytes > this.maxBytes || now - this.chunks[this.head].ts > this.maxMs)) {
      this.totalBytes -= this.chunks[this.head].data.length;
      this.head++;
    }
    // Compacta cuando la parte descartada es grande.
    if (this.head > 512 && this.head * 2 > this.chunks.length) {
      this.chunks = this.chunks.slice(this.head);
      this.head = 0;
    }
  }

  /** Fragmentos con `fromTs <= ts <= toTs`, en orden. */
  range(fromTs: number, toTs: number): Uint8Array[] {
    const out: Uint8Array[] = [];
    for (let i = this.head; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      if (c.ts > toTs) break;
      if (c.ts >= fromTs) out.push(c.data);
    }
    return out;
  }

  clear(): void {
    this.chunks = [];
    this.head = 0;
    this.totalBytes = 0;
  }

  /** [primer ts, último ts] o `null` si está vacío. */
  get span(): [number, number] | null {
    if (this.head >= this.chunks.length) return null;
    return [this.chunks[this.head].ts, this.chunks[this.chunks.length - 1].ts];
  }

  get bytes(): number {
    return this.totalBytes;
  }

  get size(): number {
    return this.chunks.length - this.head;
  }
}
