export interface AnchorInput {
  /** Rectángulo de la pantalla del terminal en coordenadas de ventana. */
  screen: { left: number; top: number; width: number; height: number };
  cols: number;
  rows: number;
  cursorX: number;
  cursorY: number;
}

export interface PopupAnchor {
  left: number;
  /** Borde superior del popup si se abre debajo del cursor; borde inferior si `above`. */
  top: number;
  above: boolean;
}

/** Calcula dónde colocar un popup junto al cursor del terminal, volteándolo si no cabe debajo. */
export function anchorPopup(
  a: AnchorInput,
  popup: { width: number; height: number },
  viewport: { width: number; height: number },
): PopupAnchor {
  const cellW = a.cols > 0 ? a.screen.width / a.cols : 0;
  const cellH = a.rows > 0 ? a.screen.height / a.rows : 0;
  const rawLeft = a.screen.left + a.cursorX * cellW;
  const left = Math.max(0, Math.min(rawLeft, viewport.width - popup.width));
  const below = a.screen.top + (a.cursorY + 1) * cellH;
  const cursorTop = a.screen.top + a.cursorY * cellH;
  if (below + popup.height <= viewport.height || cursorTop - popup.height < 0) {
    return { left, top: below, above: false };
  }
  return { left, top: cursorTop, above: true };
}
