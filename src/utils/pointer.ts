export interface Size {
  w: number;
  h: number;
}

export interface ClientRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), Math.max(max - 1, 0));

/** Convierte coordenadas de cliente a coordenadas del escritorio remoto, acotadas al framebuffer. */
export function clientToRemote(clientX: number, clientY: number, rect: ClientRect, fb: Size): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  const x = Math.floor(((clientX - rect.left) * fb.w) / rect.width);
  const y = Math.floor(((clientY - rect.top) * fb.h) / rect.height);
  return { x: clamp(x, fb.w), y: clamp(y, fb.h) };
}

/** Tamaño CSS del canvas: "fit" mantiene la proporción dentro del contenedor; "actual" usa 1:1. */
export function fitSize(container: Size, fb: Size, mode: "fit" | "actual"): Size {
  if (fb.w <= 0 || fb.h <= 0) return { w: 0, h: 0 };
  if (mode === "actual") return { w: fb.w, h: fb.h };
  const s = Math.min(container.w / fb.w, container.h / fb.h);
  return { w: Math.max(1, Math.floor(fb.w * s)), h: Math.max(1, Math.floor(fb.h * s)) };
}

/** Formatea una huella hex como `AB:CD:…` para mostrarla al usuario. */
export function formatFingerprint(hex: string): string {
  return (hex.toUpperCase().match(/.{1,2}/g) ?? []).join(":");
}
