// Navegación por teclado entre paneles: calcula el panel contiguo en una dirección a partir del
// árbol de divisiones y sus proporciones (sin depender del DOM).
import type { PaneNode } from "../types/session";

export type FocusDirection = "left" | "right" | "up" | "down";

interface Rect { id: string; x: number; y: number; w: number; h: number }

const EPS = 1e-9;

/** Reparte el cuadrado unidad entre las hojas según `direction` y `ratio` (el separador se ignora). */
function layoutLeaves(node: PaneNode, x = 0, y = 0, w = 1, h = 1, out: Rect[] = []): Rect[] {
  if (node.type === "leaf") {
    out.push({ id: node.id, x, y, w, h });
    return out;
  }
  const r = Math.min(1, Math.max(0, node.ratio));
  if (node.direction === "horizontal") {
    // horizontal = lado a lado: `first` a la izquierda, `second` a la derecha
    layoutLeaves(node.first, x, y, w * r, h, out);
    layoutLeaves(node.second, x + w * r, y, w * (1 - r), h, out);
  } else {
    // vertical = apilado: `first` arriba, `second` abajo
    layoutLeaves(node.first, x, y, w, h * r, out);
    layoutLeaves(node.second, x, y + h * r, w, h * (1 - r), out);
  }
  return out;
}

const overlap = (a1: number, a2: number, b1: number, b2: number) => Math.min(a2, b2) - Math.max(a1, b1);

/**
 * Devuelve el id del panel contiguo en la dirección dada, o `null` si no hay ninguno.
 * Con varios candidatos gana el más cercano en el eje de movimiento y, ante un empate,
 * el de centro más próximo en el eje perpendicular (después, el primero en orden de recorrido).
 */
export function findNeighborPane(root: PaneNode, activeId: string, dir: FocusDirection): string | null {
  const leaves = layoutLeaves(root);
  const a = leaves.find((l) => l.id === activeId);
  if (!a) return null;
  const horizontal = dir === "left" || dir === "right";

  let best: { id: string; gap: number; off: number } | null = null;
  for (const c of leaves) {
    if (c.id === a.id) continue;
    let gap: number;
    if (dir === "right") gap = c.x - (a.x + a.w);
    else if (dir === "left") gap = a.x - (c.x + c.w);
    else if (dir === "down") gap = c.y - (a.y + a.h);
    else gap = a.y - (c.y + c.h);
    if (gap < -EPS) continue; // no está en esa dirección

    const shared = horizontal ? overlap(a.y, a.y + a.h, c.y, c.y + c.h) : overlap(a.x, a.x + a.w, c.x, c.x + c.w);
    if (shared <= EPS) continue; // no se solapa en el eje perpendicular

    const off = horizontal
      ? Math.abs(a.y + a.h / 2 - (c.y + c.h / 2))
      : Math.abs(a.x + a.w / 2 - (c.x + c.w / 2));
    if (!best || gap < best.gap - EPS || (Math.abs(gap - best.gap) <= EPS && off < best.off - EPS)) {
      best = { id: c.id, gap, off };
    }
  }
  return best?.id ?? null;
}
