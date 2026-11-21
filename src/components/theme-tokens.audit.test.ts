// Guard anti-regresión del sistema de temas: los componentes NO deben usar colores fijos de Tailwind ni hex
// literales; todo color de interfaz sale de los tokens de tema (bg-surface, text-fg, border-line, accent, ...).
import { describe, it, expect } from "vitest";

const SOURCES = import.meta.glob(["./**/*.vue", "../App.vue"], { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

const FIXED_TAILWIND =
  /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|divide|outline|from|to|via|fill|stroke|shadow|accent|placeholder)-(?:neutral|slate|zinc|gray|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|pink)-\d{2,3}/;
const FIXED_BW = /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring)-(?:white|black)(?![\w-])/;
const LEGACY_ALIAS = /(?<![\w-])(?:bg-theme-|text-theme-|border-theme)/;
// Hex permitidos: datos elegidos por el usuario (color de carpeta) y la vista previa de temas (usa el tema real).
const HEX_ALLOWED = ["hosts/FolderModal.vue", "hosts/HostTreeSidebar.vue", "settings/SettingsModal.vue"];
const HEX = /#[0-9a-fA-F]{6}\b/;

describe("theme token audit", () => {
  const entries = Object.entries(SOURCES);

  it("scans the component sources", () => {
    expect(entries.length).toBeGreaterThan(20);
  });

  it("uses no fixed Tailwind palette colors", () => {
    const offenders = entries.filter(([, src]) => FIXED_TAILWIND.test(src) || FIXED_BW.test(src)).map(([f]) => f);
    expect(offenders).toEqual([]);
  });

  it("uses no legacy bg-theme-* aliases", () => {
    const offenders = entries.filter(([, src]) => LEGACY_ALIAS.test(src)).map(([f]) => f);
    expect(offenders).toEqual([]);
  });

  it("uses no literal hex colors outside reviewed exceptions", () => {
    const offenders = entries
      .filter(([f, src]) => HEX.test(src) && !HEX_ALLOWED.some((a) => f.endsWith(a)))
      .map(([f]) => f);
    expect(offenders).toEqual([]);
  });
});
