// Comprobación de fuentes para las ligaduras: la ligadura la dibuja la fuente, por lo que si la
// fuente efectiva no está instalada (o no tiene ligaduras) activar la opción no cambia nada.

/** Familias genéricas CSS: no se pueden comprobar ni aportan ligaduras. */
const GENERIC_FAMILIES = new Set(["monospace", "serif", "sans-serif", "cursive", "fantasy", "system-ui", "ui-monospace"]);

/** Fuentes de programación conocidas por incluir ligaduras (incluye variantes Nerd Font). */
const LIGATURE_FONT_PATTERN =
  /(jetbrains\s*mono|fira\s*code|firacode|cascadia\s*(code|mono)|iosevka|hasklig|victor\s*mono|monaspace|lilex|maple\s*mono|geist\s*mono|ibm\s*plex\s*mono\s*ligat|fantasque|mononoki|recursive\s*mono|commit\s*mono|source\s*code\s*pro\s*ligat)/i;

/** Extrae las familias de una lista CSS `font-family`, sin comillas. */
export function parseFontStack(css: string): string[] {
  return css
    .split(",")
    .map((f) => f.trim().replace(/^['"]|['"]$/g, "").trim())
    .filter((f) => f.length > 0);
}

export function isLigatureFont(family: string): boolean {
  return LIGATURE_FONT_PATTERN.test(family);
}

export type MeasureFn = (font: string, text: string) => number;

const PROBE = "mmmmmmmmmmlliWWiiOO0";
const FALLBACKS = ["monospace", "serif", "sans-serif"];

/**
 * Crea un detector de fuentes instaladas: una fuente existe si cambia el ancho del texto respecto a
 * cada fuente genérica de respaldo (`document.fonts.check` no sirve: devuelve true para fuentes
 * inexistentes).
 */
export function makeInstalledChecker(measure: MeasureFn): (family: string) => boolean {
  return (family: string) => {
    if (!family || GENERIC_FAMILIES.has(family.toLowerCase())) return false;
    const quoted = `"${family.replace(/"/g, "")}"`;
    return FALLBACKS.some((fb) => measure(`72px ${quoted}, ${fb}`, PROBE) !== measure(`72px ${fb}`, PROBE));
  };
}

/** Detector real basado en canvas (solo navegador). */
export function createCanvasInstalledChecker(): (family: string) => boolean {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = document.createElement("canvas").getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return () => true; // sin canvas no se puede comprobar: no se muestra ningún aviso
  const c = ctx;
  return makeInstalledChecker((font, text) => {
    c.font = font;
    return c.measureText(text).width;
  });
}

export interface LigatureStatus {
  /** Primera fuente instalada de la lista (la que realmente se usa), o `null` si solo hay genéricas. */
  effective: string | null;
  /** Si la fuente efectiva es conocida por traer ligaduras. */
  ok: boolean;
  /** Fuentes de la lista que traen ligaduras pero no están instaladas. */
  missing: string[];
}

export function ligatureStatus(stack: string, isInstalled: (family: string) => boolean): LigatureStatus {
  const families = parseFontStack(stack);
  const effective = families.find((f) => isInstalled(f)) ?? null;
  return {
    effective,
    ok: effective !== null && isLigatureFont(effective),
    missing: families.filter((f) => isLigatureFont(f) && !isInstalled(f)),
  };
}
