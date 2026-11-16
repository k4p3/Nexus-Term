import { describe, it, expect } from "vitest";
import prepareScript from "../../scripts/prepare-site.sh?raw";
import styleCss from "../../site/assets/style.css?raw";
import siteJs from "../../site/assets/site.js?raw";
import { SHORTCUTS, formatShortcut } from "./shortcuts";

// Todo el contenido de site/ como texto (se excluye assets/img: lo genera scripts/prepare-site.sh).
const RAW = import.meta.glob(["../../site/**/*", "../../site/.nojekyll", "!../../site/assets/img/**"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const FILES: Record<string, string> = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [k.replace("../../site/", ""), v]),
);
// El glob devuelve vacío para el CSS (Vite lo procesa): se usan importaciones explícitas.
FILES["assets/style.css"] = styleCss;
FILES["assets/site.js"] = siteJs;
const read = (rel: string) => {
  if (!(rel in FILES)) throw new Error(`site/${rel} not found`);
  return FILES[rel];
};
const exists = (rel: string) => rel in FILES;

/** Resuelve una referencia relativa (con `..`) respecto a la página que la contiene. */
function resolveRef(fromPage: string, ref: string): string {
  const parts = fromPage.split("/").slice(0, -1);
  for (const seg of ref.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  return parts.join("/");
}

/** Páginas equivalentes entre idiomas (clave → [en, es]). */
const PAIRS: Record<string, [string, string]> = {
  home: ["en/index.html", "es/index.html"],
  guide: ["en/guide.html", "es/guia.html"],
  shortcuts: ["en/shortcuts.html", "es/atajos.html"],
};
const PAGES = Object.values(PAIRS).flat();
const ALL_HTML = [...PAGES, "index.html", "404.html"];

const normalize = (s: string) => s.replace(/<\/?kbd>/g, "").replace(/`/g, "").replace(/\s+/g, "");

describe("site: structure", () => {
  it("reads real content (guards against vacuous checks)", () => {
    for (const f of ["assets/style.css", "assets/site.js", "index.html", "en/index.html", "es/index.html"]) {
      expect(read(f).length, f).toBeGreaterThan(200);
    }
  });

  it("has the same set of pages in Spanish and English", () => {
    const en = Object.keys(FILES).filter((f) => /^en\/[^/]+\.html$/.test(f)).map((f) => f.slice(3)).sort();
    const es = Object.keys(FILES).filter((f) => /^es\/[^/]+\.html$/.test(f)).map((f) => f.slice(3)).sort();
    expect(en).toEqual(Object.values(PAIRS).map(([e]) => e.split("/")[1]).sort());
    expect(es).toEqual(Object.values(PAIRS).map(([, s]) => s.split("/")[1]).sort());
  });

  it("ships the auxiliary files", () => {
    for (const f of ["404.html", "robots.txt", "sitemap.xml", ".nojekyll", "assets/style.css", "assets/site.js"]) {
      expect(exists(f), f).toBe(true);
    }
  });

  it("lists only existing pages in the sitemap and links it from robots.txt", () => {
    const urls = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      const rel = u.replace(/^https:\/\/k4p3\.github\.io\/Nexus-Term\//, "");
      expect(exists(rel === "" ? "index.html" : rel), u).toBe(true);
    }
    expect(read("robots.txt")).toContain("sitemap.xml");
  });
});

describe("site: page metadata", () => {
  const titles = new Set<string>();
  for (const page of PAGES) {
    const html = read(page);
    const lang = page.startsWith("es/") ? "es" : "en";

    it(`${page}: declares language, title, description and a single h1`, () => {
      expect(html).toMatch(new RegExp(`<html lang="${lang}">`));
      const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
      expect(title, "title").toBeTruthy();
      expect(titles.has(title!), `duplicate title: ${title}`).toBe(false);
      titles.add(title!);
      expect(html).toMatch(/<meta name="description" content="[^"]{40,}">/);
      expect(html.match(/<h1[ >]/g)?.length).toBe(1);
      expect(html).toContain('<main id="main">');
    });

    it(`${page}: has hreflang alternates pointing at both languages`, () => {
      expect(html).toMatch(/hreflang="en" href="https:\/\/k4p3\.github\.io\/Nexus-Term\/en\//);
      expect(html).toMatch(/hreflang="es" href="https:\/\/k4p3\.github\.io\/Nexus-Term\/es\//);
      expect(html).toContain('hreflang="x-default"');
    });
  }

  it("each page links to its counterpart in the other language", () => {
    for (const [en, es] of Object.values(PAIRS)) {
      expect(read(en)).toContain(`href="../es/${es.split("/")[1]}"`);
      expect(read(es)).toContain(`href="../en/${en.split("/")[1]}"`);
    }
  });
});

describe("site: shortcuts page lists every registered shortcut", () => {
  for (const [label, page] of [["en", PAIRS.shortcuts[0]], ["es", PAIRS.shortcuts[1]]] as const) {
    const text = normalize(read(page));
    for (const def of SHORTCUTS) {
      const accepted = def.id === "terminal.splitHAlt" ? ["Ctrl+Shift+O/D"] : [formatShortcut(def, "other")];
      it(`${def.id} (${accepted[0]}) appears in ${label}`, () => {
        expect(accepted.some((a) => text.includes(a))).toBe(true);
      });
    }
  }
});

describe("site: links and resources", () => {
  const GENERATED = /^(\.\.\/|\.\/|\/Nexus-Term\/|)assets\/img\//; // los crea scripts/prepare-site.sh
  const refs = (html: string) =>
    [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith("#"));

  for (const page of ALL_HTML) {
    it(`${page}: every local reference exists`, () => {
      const html = read(page);
      for (const ref of refs(html)) {
        if (/^(https?:|mailto:|\/\/)/.test(ref)) continue;
        const clean = ref.split("#")[0].split("?")[0];
        if (!clean || GENERATED.test(clean)) continue;
        const target = clean.startsWith("/Nexus-Term/") ? clean.replace("/Nexus-Term/", "") : resolveRef(page, clean);
        expect(exists(target), `${page} -> ${ref}`).toBe(true);
      }
    });
  }

  it("generated image paths match what prepare-site.sh copies", () => {
    const script = prepareScript;
    for (const name of ["social-preview.png", "favicon.ico", "logo.png"]) expect(script).toContain(`"${name}"`);
    const used = new Set<string>();
    for (const page of ALL_HTML) for (const m of read(page).matchAll(/assets\/img\/([\w.-]+)/g)) used.add(m[1]);
    for (const name of used) expect(script, name).toContain(`"${name}"`);
  });
});

describe("site: privacy claim", () => {
  it("states the no-telemetry claim on both home pages (backed by privacy.audit.test.ts)", () => {
    for (const page of [PAIRS.home[0], PAIRS.home[1]]) {
      const html = read(page);
      expect(html, page).toContain('data-claim="no-telemetry"');
      expect(html, page).toMatch(/data-claim="no-telemetry"><strong>[^<]{40,}<\/strong>/);
    }
  });
});

describe("site: privacy and independence", () => {
  const external = /^(https?:)?\/\//;

  it("loads no script, stylesheet, image, font or media from another domain", () => {
    for (const page of ALL_HTML) {
      const html = read(page);
      for (const m of html.matchAll(/<(script|img|source|video|audio|iframe)\b[^>]*\bsrc="([^"]+)"/g)) {
        expect(external.test(m[2]), `${page}: <${m[1]} src="${m[2]}">`).toBe(false);
      }
      for (const m of html.matchAll(/<link\b[^>]*>/g)) {
        const rel = m[0].match(/rel="([^"]+)"/)?.[1] ?? "";
        const href = m[0].match(/href="([^"]+)"/)?.[1] ?? "";
        if (/stylesheet|icon|preload|prefetch|modulepreload/.test(rel)) {
          expect(external.test(href), `${page}: <link rel="${rel}" href="${href}">`).toBe(false);
        }
      }
    }
  });

  it("CSS and JS do not reference external domains", () => {
    for (const f of ["assets/style.css", "assets/site.js"]) {
      const src = read(f);
      expect(/url\(\s*['"]?(https?:)?\/\//.test(src), `${f} url()`).toBe(false);
      expect(/@import\s+(url\()?['"]?(https?:)?\/\//.test(src), `${f} @import`).toBe(false);
      expect(/\bfetch\(|XMLHttpRequest|sendBeacon|gtag|analytics/i.test(src), `${f} network`).toBe(false);
    }
  });

  it("only ships files that belong to the site (no stray dependencies)", () => {
    expect(Object.keys(FILES).filter((f) => /node_modules|package(-lock)?\.json/.test(f))).toEqual([]);
  });
});

describe("site: accessibility basics", () => {
  it("mock-up illustrations have a text alternative and a caption", () => {
    for (const page of PAGES) {
      for (const m of read(page).matchAll(/<figure class="shot"[^>]*>/g)) {
        expect(m[0], page).toMatch(/role="img"/);
        expect(m[0], page).toMatch(/aria-label="[^"]{10,}"/);
      }
    }
  });

  it("respects the colour-scheme preference and has a skip link", () => {
    expect(read("assets/style.css")).toContain("prefers-color-scheme: light");
    for (const page of PAGES) expect(read(page)).toContain('class="skip"');
  });
});
