// Navegación por teclado y cálculo de geometría plana entre paneles: calcula rectángulos de hojas,
// divisores interactivos y el panel contiguo en una dirección a partir del árbol de divisiones y sus
// proporciones (sin depender del DOM).
import type { LeafPane, PaneNode, SplitDirection } from "../types/session";

export type FocusDirection = "left" | "right" | "up" | "down";

export interface LeafLayoutRect {
  pane: LeafPane;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SplitterLayoutRect {
  id: string;
  direction: SplitDirection;
  ratio: number;
  /** Posición de la línea divisora en coordenadas normalizadas [0, 1]. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rectángulo contenedor del nodo SplitPane padre en coordenadas normalizadas [0, 1]. */
  containerX: number;
  containerY: number;
  containerW: number;
  containerH: number;
}

export interface PaneLayout {
  leaves: LeafLayoutRect[];
  splitters: SplitterLayoutRect[];
}

const EPS = 1e-9;

/**
 * Reparte el cuadrado unidad [0, 1] x [0, 1] entre las hojas y registra cada divisor (`SplitPane`)
 * según `direction` y `ratio` para renderizado plano sin re-montar nodos en el DOM.
 */
export function computePaneLayout(root: PaneNode): PaneLayout {
  const leaves: LeafLayoutRect[] = [];
  const splitters: SplitterLayoutRect[] = [];

  function walk(node: PaneNode, x: number, y: number, w: number, h: number) {
    if (node.type === "leaf") {
      leaves.push({ pane: node, x, y, w, h });
      return;
    }
    const r = Math.min(1, Math.max(0, node.ratio));
    if (node.direction === "horizontal") {
      // horizontal = lado a lado: `first` a la izquierda, `second` a la derecha
      const splitX = x + w * r;
      splitters.push({
        id: node.id,
        direction: "horizontal",
        ratio: r,
        x: splitX,
        y,
        w: 0,
        h,
        containerX: x,
        containerY: y,
        containerW: w,
        containerH: h,
      });
      walk(node.first, x, y, w * r, h);
      walk(node.second, splitX, y, w * (1 - r), h);
    } else {
      // vertical = apilado: `first` arriba, `second` abajo
      const splitY = y + h * r;
      splitters.push({
        id: node.id,
        direction: "vertical",
        ratio: r,
        x,
        y: splitY,
        w,
        h: 0,
        containerX: x,
        containerY: y,
        containerW: w,
        containerH: h,
      });
      walk(node.first, x, y, w, h * r);
      walk(node.second, x, splitY, w, h * (1 - r));
    }
  }

  walk(root, 0, 0, 1, 1);
  return { leaves, splitters };
}

const overlap = (a1: number, a2: number, b1: number, b2: number) => Math.min(a2, b2) - Math.max(a1, b1);

/**
 * Devuelve el id del panel contiguo en la dirección dada, o `null` si no hay ninguno.
 * Con varios candidatos gana el más cercano en el eje de movimiento y, ante un empate,
 * el de centro más próximo en el eje perpendicular (después, el primero en orden de recorrido).
 */
export function findNeighborPane(root: PaneNode, activeId: string, dir: FocusDirection): string | null {
  const { leaves } = computePaneLayout(root);
  const a = leaves.find((l) => l.pane.id === activeId);
  if (!a) return null;
  const horizontal = dir === "left" || dir === "right";

  let best: { id: string; gap: number; off: number } | null = null;
  for (const c of leaves) {
    if (c.pane.id === a.pane.id) continue;
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
      best = { id: c.pane.id, gap, off };
    }
  }
  return best?.id ?? null;
}
