/** Scancode PC/AT (set 1) y flag `extended` (prefijo E0) por `KeyboardEvent.code`. */
export interface ScancodeInfo {
  scancode: number;
  extended: boolean;
}

const BASE: Record<string, number> = {
  Escape: 0x01, Minus: 0x0c, Equal: 0x0d, Backspace: 0x0e, Tab: 0x0f,
  BracketLeft: 0x1a, BracketRight: 0x1b, Enter: 0x1c, ControlLeft: 0x1d,
  Semicolon: 0x27, Quote: 0x28, Backquote: 0x29, ShiftLeft: 0x2a, Backslash: 0x2b,
  Comma: 0x33, Period: 0x34, Slash: 0x35, ShiftRight: 0x36, NumpadMultiply: 0x37,
  AltLeft: 0x38, Space: 0x39, CapsLock: 0x3a, NumLock: 0x45, ScrollLock: 0x46,
  Numpad7: 0x47, Numpad8: 0x48, Numpad9: 0x49, NumpadSubtract: 0x4a,
  Numpad4: 0x4b, Numpad5: 0x4c, Numpad6: 0x4d, NumpadAdd: 0x4e,
  Numpad1: 0x4f, Numpad2: 0x50, Numpad3: 0x51, Numpad0: 0x52, NumpadDecimal: 0x53,
  IntlBackslash: 0x56, F11: 0x57, F12: 0x58,
};

const EXTENDED: Record<string, number> = {
  NumpadEnter: 0x1c, ControlRight: 0x1d, NumpadDivide: 0x35, AltRight: 0x38,
  Home: 0x47, ArrowUp: 0x48, PageUp: 0x49, ArrowLeft: 0x4b, ArrowRight: 0x4d,
  End: 0x4f, ArrowDown: 0x50, PageDown: 0x51, Insert: 0x52, Delete: 0x53,
  MetaLeft: 0x5b, MetaRight: 0x5c, ContextMenu: 0x5d,
};

const TABLE: Record<string, ScancodeInfo> = {};
for (const [code, sc] of Object.entries(BASE)) TABLE[code] = { scancode: sc, extended: false };
for (const [code, sc] of Object.entries(EXTENDED)) TABLE[code] = { scancode: sc, extended: true };
"1234567890".split("").forEach((d, i) => {
  TABLE[`Digit${d}`] = { scancode: 0x02 + i, extended: false };
});
[..."QWERTYUIOP"].forEach((c, i) => (TABLE[`Key${c}`] = { scancode: 0x10 + i, extended: false }));
[..."ASDFGHJKL"].forEach((c, i) => (TABLE[`Key${c}`] = { scancode: 0x1e + i, extended: false }));
[..."ZXCVBNM"].forEach((c, i) => (TABLE[`Key${c}`] = { scancode: 0x2c + i, extended: false }));
for (let i = 1; i <= 10; i++) TABLE[`F${i}`] = { scancode: 0x3a + i, extended: false };

export function codeToScancode(code: string): ScancodeInfo | null {
  return TABLE[code] ?? null;
}

/**
 * Keysym X11 de un carácter imprimible (`KeyboardEvent.key` de un solo carácter).
 * Latin-1 coincide con el codepoint; el resto usa el rango Unicode 0x01000000+.
 * Devuelve `null` para teclas especiales (el backend usa su tabla de respaldo).
 */
export function keysymFromKey(key: string): number | null {
  const chars = [...key];
  if (chars.length !== 1) return null;
  const cp = chars[0].codePointAt(0)!;
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return null;
  return cp <= 0xff ? cp : 0x01000000 + cp;
}

/** `MouseEvent.buttons` (DOM: 1=izq, 2=der, 4=central) → máscara del backend (1=izq, 2=central, 4=der). */
export function domButtonsToMask(buttons: number): number {
  return (buttons & 1) | ((buttons & 4) >> 1) | ((buttons & 2) << 1);
}

/** Convierte `deltaY`/`deltaX` de la rueda en "notches" (signo: positivo = arriba/derecha). */
export function wheelNotches(delta: number): number {
  if (delta === 0) return 0;
  const n = Math.max(1, Math.round(Math.abs(delta) / 100));
  return delta < 0 ? n : -n;
}

/** Teclas que no deben activar atajos locales mientras el canvas remoto tiene el foco. */
export function shouldCaptureKey(e: { ctrlKey: boolean; altKey: boolean; key: string }): boolean {
  // Mantener F12 (devtools) y Ctrl+Shift+I disponibles para depurar.
  return e.key !== "F12";
}
