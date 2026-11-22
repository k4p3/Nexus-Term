import { describe, it, expect } from "vitest";
import { anchorPopup } from "./popup-anchor";

const base = { screen: { left: 100, top: 50, width: 800, height: 400 }, cols: 80, rows: 20 };
const popup = { width: 480, height: 100 };
const viewport = { width: 1200, height: 700 };

describe("anchorPopup", () => {
  it("opens below the cursor cell", () => {
    const a = anchorPopup({ ...base, cursorX: 4, cursorY: 2 }, popup, viewport);
    expect(a).toEqual({ left: 140, top: 110, above: false });
  });

  it("flips above when there is no room below", () => {
    const a = anchorPopup({ ...base, cursorX: 0, cursorY: 19 }, popup, { width: 1200, height: 470 });
    expect(a.above).toBe(true);
    expect(a.top).toBe(430); // borde superior de la fila del cursor
  });

  it("stays below when it fits neither above nor below", () => {
    const a = anchorPopup({ ...base, cursorX: 0, cursorY: 0 }, { width: 480, height: 900 }, viewport);
    expect(a.above).toBe(false);
  });

  it("clamps horizontally inside the viewport", () => {
    const a = anchorPopup({ ...base, cursorX: 79, cursorY: 0 }, popup, { width: 600, height: 700 });
    expect(a.left).toBe(120);
  });
});
