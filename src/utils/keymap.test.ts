import { describe, it, expect } from "vitest";
import { codeToScancode, domButtonsToMask, keysymFromKey, wheelNotches } from "./keymap";

describe("keymap", () => {
  it("maps letters, digits and function keys to set-1 scancodes", () => {
    expect(codeToScancode("KeyA")).toEqual({ scancode: 0x1e, extended: false });
    expect(codeToScancode("KeyQ")).toEqual({ scancode: 0x10, extended: false });
    expect(codeToScancode("KeyM")).toEqual({ scancode: 0x32, extended: false });
    expect(codeToScancode("Digit1")).toEqual({ scancode: 0x02, extended: false });
    expect(codeToScancode("Digit0")).toEqual({ scancode: 0x0b, extended: false });
    expect(codeToScancode("F1")).toEqual({ scancode: 0x3b, extended: false });
    expect(codeToScancode("F10")).toEqual({ scancode: 0x44, extended: false });
    expect(codeToScancode("F12")).toEqual({ scancode: 0x58, extended: false });
  });

  it("flags extended keys", () => {
    expect(codeToScancode("ArrowUp")).toEqual({ scancode: 0x48, extended: true });
    expect(codeToScancode("Delete")).toEqual({ scancode: 0x53, extended: true });
    expect(codeToScancode("ControlRight")).toEqual({ scancode: 0x1d, extended: true });
    expect(codeToScancode("NumpadEnter")).toEqual({ scancode: 0x1c, extended: true });
    expect(codeToScancode("Enter")).toEqual({ scancode: 0x1c, extended: false });
  });

  it("returns null for unknown codes", () => {
    expect(codeToScancode("Unidentified")).toBeNull();
  });

  it("derives keysyms from printable characters only", () => {
    expect(keysymFromKey("a")).toBe(0x61);
    expect(keysymFromKey("A")).toBe(0x41);
    expect(keysymFromKey("ñ")).toBe(0xf1);
    expect(keysymFromKey("€")).toBe(0x01000000 + 0x20ac);
    expect(keysymFromKey("Enter")).toBeNull();
    expect(keysymFromKey("")).toBeNull();
    expect(keysymFromKey("\u0007")).toBeNull();
  });

  it("converts DOM mouse button bitmask to backend mask", () => {
    expect(domButtonsToMask(0)).toBe(0);
    expect(domButtonsToMask(1)).toBe(1); // izquierdo
    expect(domButtonsToMask(2)).toBe(4); // derecho
    expect(domButtonsToMask(4)).toBe(2); // central
    expect(domButtonsToMask(1 | 2)).toBe(1 | 4);
  });

  it("converts wheel deltas into notches (positive = up)", () => {
    expect(wheelNotches(0)).toBe(0);
    expect(wheelNotches(-100)).toBe(1);
    expect(wheelNotches(-300)).toBe(3);
    expect(wheelNotches(100)).toBe(-1);
    expect(wheelNotches(10)).toBe(-1);
  });
});
