import { describe, it, expect } from "vitest";
import { parseFontStack, isLigatureFont, makeInstalledChecker, ligatureStatus, type MeasureFn } from "./font-check";

/** Simula el navegador: cada fuente instalada tiene un ancho propio; si no, se usa el del genérico. */
function fakeMeasure(installed: Record<string, number>): MeasureFn {
  const generic: Record<string, number> = { monospace: 100, serif: 130, "sans-serif": 120 };
  return (font) => {
    const m = font.match(/^72px (?:"([^"]+)", )?(monospace|serif|sans-serif)$/);
    if (!m) return -1;
    const [, fam, fb] = m;
    return fam && fam in installed ? installed[fam] : generic[fb];
  };
}

describe("parseFontStack", () => {
  it("splits, trims and removes quotes", () => {
    expect(parseFontStack("'JetBrainsMono Nerd Font', \"JetBrains Mono\" , monospace")).toEqual([
      "JetBrainsMono Nerd Font", "JetBrains Mono", "monospace",
    ]);
  });
  it("ignores empty entries", () => {
    expect(parseFontStack(" , a,, ")).toEqual(["a"]);
    expect(parseFontStack("")).toEqual([]);
  });
});

describe("isLigatureFont", () => {
  it("recognises common ligature fonts and their Nerd Font variants", () => {
    for (const f of ["JetBrains Mono", "JetBrainsMono Nerd Font", "Fira Code", "FiraCode Nerd Font Mono", "Cascadia Code", "Iosevka", "Monaspace Neon"]) {
      expect(isLigatureFont(f), f).toBe(true);
    }
  });
  it("rejects fonts without ligatures", () => {
    for (const f of ["Hack", "Hack Nerd Font", "MesloLGS NF", "DejaVu Sans Mono", "Noto Sans Mono", "monospace"]) {
      expect(isLigatureFont(f), f).toBe(false);
    }
  });
});

describe("makeInstalledChecker", () => {
  const check = makeInstalledChecker(fakeMeasure({ "JetBrains Mono": 90, Hack: 100, "Noto Sans Mono": 100 }));
  it("detects installed fonts by a width difference", () => {
    expect(check("JetBrains Mono")).toBe(true);
  });
  it("detects fonts whose width equals one fallback but differs from another", () => {
    expect(check("Hack")).toBe(true); // = monospace pero distinto de serif/sans-serif
  });
  it("reports missing fonts as not installed", () => {
    expect(check("Fira Code")).toBe(false);
  });
  it("never treats generic families or empty names as installed", () => {
    expect(check("monospace")).toBe(false);
    expect(check("")).toBe(false);
    expect(check("Sans-Serif")).toBe(false);
  });
});

describe("ligatureStatus", () => {
  const installed = (...names: string[]) => (f: string) => names.includes(f);

  it("ok when the first installed font has ligatures", () => {
    const s = ligatureStatus("'JetBrainsMono Nerd Font', 'JetBrains Mono', monospace", installed("JetBrains Mono"));
    expect(s).toEqual({ effective: "JetBrains Mono", ok: true, missing: ["JetBrainsMono Nerd Font"] });
  });

  it("not ok when the stack only resolves to a font without ligatures", () => {
    const s = ligatureStatus("'Fira Code', 'Hack Nerd Font', monospace", installed("Hack Nerd Font"));
    expect(s.effective).toBe("Hack Nerd Font");
    expect(s.ok).toBe(false);
    expect(s.missing).toEqual(["Fira Code"]);
  });

  it("not ok when a ligature font is listed after a non-ligature installed one", () => {
    const s = ligatureStatus("Hack, 'Fira Code'", installed("Hack", "Fira Code"));
    expect(s.effective).toBe("Hack"); // la que realmente se dibuja
    expect(s.ok).toBe(false);
  });

  it("not ok when nothing in the stack is installed", () => {
    const s = ligatureStatus("'JetBrains Mono', monospace", installed());
    expect(s.effective).toBeNull();
    expect(s.ok).toBe(false);
    expect(s.missing).toEqual(["JetBrains Mono"]);
  });
});
