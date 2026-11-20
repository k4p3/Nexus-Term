// Auditoría de privacidad: respalda la afirmación pública del sitio web
// («NexusTerm no recopila datos de uso ni contacta con ningún servicio salvo los servidores a los que te conectas»).
//
// Si esta prueba falla, NO la relajes sin más: o se ha introducido una conexión/recopilación que contradice esa
// afirmación (corrígelo), o es una excepción legítima y revisada (añádela a las listas de abajo, documéntala en
// el cambio de OpenSpec y actualiza el texto del sitio en site/ para que siga siendo cierto).
import { describe, it, expect } from "vitest";
import cargoToml from "../../src-tauri/Cargo.toml?raw";
import packageJson from "../../package.json?raw";
import capabilities from "../../src-tauri/capabilities/default.json?raw";
import indexHtml from "../../index.html?raw";

const FRONTEND = import.meta.glob(["../**/*.ts", "../**/*.vue", "!../**/*.test.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const RUST = import.meta.glob("../../src-tauri/src/**/*.rs", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

// ---- Listas de excepciones revisadas -------------------------------------------------------------
/** Plugins de Tauri permitidos (y sus paquetes npm). Cualquier otro debe revisarse a propósito. */
const ALLOWED_TAURI_PLUGINS = ["tauri-plugin-notification", "tauri-plugin-single-instance"];
// single-instance: solo IPC local entre procesos (D-Bus / socket local) para reenfocar la ventana; sin red.
const ALLOWED_NPM_PLUGINS = ["@tauri-apps/plugin-notification"];
/** Permisos de la ventana principal. Añadir `http:*`, `shell:*`, `updater:*`… cambiaría la superficie de red. */
const ALLOWED_PERMISSIONS = ["core:default", "notification:default"];
/** URLs externas permitidas en el código (texto de ejemplo; nunca se solicitan). */
const ALLOWED_URL_SNIPPETS: Record<string, string[]> = {
  "snippets.rs": ["https://google.com"], // valor por defecto de un snippet de ejemplo: `curl -I {{url=…}}`
};
// ---------------------------------------------------------------------------------------------------

const code = (src: string) =>
  src
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l)) // sin comentarios de línea
    .join("\n");

const cargoDeps = (): string[] => {
  const m = cargoToml.match(/\[dependencies\]([\s\S]*?)(?:\n\[|$)/);
  return [...(m?.[1] ?? "").matchAll(/^([A-Za-z0-9_-]+)\s*=/gm)].map((x) => x[1]);
};

describe("privacy audit: the test reads real sources (guards against vacuous checks)", () => {
  it("finds the frontend and backend sources", () => {
    expect(Object.keys(FRONTEND).length).toBeGreaterThan(40);
    expect(Object.keys(RUST).length).toBeGreaterThan(15);
    expect(cargoDeps().length).toBeGreaterThan(20);
    expect(indexHtml.length).toBeGreaterThan(100);
  });
});

describe("privacy audit: frontend", () => {
  it("makes no network requests with browser APIs", () => {
    const banned = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|EventSource|importScripts|WebTransport|RTCPeerConnection/;
    for (const [file, src] of Object.entries(FRONTEND)) {
      expect(banned.test(code(src)), `${file} uses a network API`).toBe(false);
    }
  });

  it("does not use analytics, error-reporting or tracking libraries", () => {
    const banned = /gtag|googletagmanager|google-analytics|posthog|sentry|mixpanel|amplitude|segment\.|umami|plausible|matomo|hotjar|bugsnag|datadog|logrocket|fullstory/i;
    for (const [file, src] of Object.entries(FRONTEND)) {
      expect(banned.test(code(src)), `${file} references an analytics/tracking library`).toBe(false);
    }
  });

  it("references no external URL in the application code", () => {
    for (const [file, src] of Object.entries(FRONTEND)) {
      const urls = [...code(src).matchAll(/https?:\/\/[^\s"'`)<>]+/g)].map((m) => m[0]);
      const external = urls.filter((u) => !/^https?:\/\/(www\.w3\.org|localhost|127\.0\.0\.1)/.test(u));
      expect(external, `${file} references external URLs`).toEqual([]);
    }
  });

  it("index.html loads nothing from another domain", () => {
    expect(/<(script|link|img|iframe)\b[^>]*\b(src|href)="(https?:)?\/\//.test(indexHtml)).toBe(false);
  });

  it("only depends on the reviewed Tauri plugins and no analytics packages in npm", () => {
    const pkg = JSON.parse(packageJson) as { dependencies: Record<string, string> };
    const deps = Object.keys(pkg.dependencies);
    const plugins = deps.filter((d) => d.startsWith("@tauri-apps/plugin-"));
    expect(plugins.sort()).toEqual([...ALLOWED_NPM_PLUGINS].sort());
    const banned = /analytics|telemetry|sentry|posthog|mixpanel|amplitude|segment|bugsnag|datadog|rollbar|logrocket|hotjar|fullstory|umami|plausible|matomo/i;
    const httpClients = /^(axios|node-fetch|ky|got|superagent|undici|cross-fetch|isomorphic-fetch)$/;
    expect(deps.filter((d) => banned.test(d) || httpClients.test(d))).toEqual([]);
  });
});

describe("privacy audit: backend (Rust)", () => {
  it("has no HTTP client, analytics or error-reporting crates among its direct dependencies", () => {
    const banned = /^(reqwest|hyper|hyper-util|ureq|isahc|surf|attohttpc|curl|minreq|awc|sentry.*|opentelemetry.*|posthog.*|segment.*|mixpanel.*|tauri-plugin-(http|updater|log|shell|opener|process|os|store|fs|deep-link|autostart|upload))$/;
    expect(cargoDeps().filter((d) => banned.test(d))).toEqual([]);
  });

  it("only uses the reviewed Tauri plugins", () => {
    const plugins = cargoDeps().filter((d) => d.startsWith("tauri-plugin-"));
    expect(plugins.sort()).toEqual([...ALLOWED_TAURI_PLUGINS].sort());
  });

  it("grants the main window only the reviewed permissions", () => {
    const caps = JSON.parse(capabilities) as { permissions: string[] };
    expect([...caps.permissions].sort()).toEqual([...ALLOWED_PERMISSIONS].sort());
  });

  it("does not call HTTP clients or reference external URLs in the Rust sources", () => {
    for (const [file, src] of Object.entries(RUST)) {
      const c = code(src);
      expect(/\b(reqwest|hyper|ureq|isahc|attohttpc|minreq)::/.test(c), `${file} uses an HTTP client`).toBe(false);
      const name = file.split("/").pop() ?? file;
      const allowed = ALLOWED_URL_SNIPPETS[name] ?? [];
      const urls = [...c.matchAll(/https?:\/\/[^\s"'`)}<>]+/g)].map((m) => m[0]);
      const external = urls.filter((u) => !allowed.some((a) => u.startsWith(a)) && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u));
      expect(external, `${file} references external URLs`).toEqual([]);
    }
  });

  it("opens outbound connections only from the reviewed SSH/SFTP, remote desktop and tunnel modules", () => {
    const outbound = /TcpStream::connect|UdpSocket|connect_stream\(|client::connect\(/;
    const allowedDirs = ["/ssh/", "/sftp/", "/remote_desktop/", "/tunnels/"];
    for (const [file, src] of Object.entries(RUST)) {
      if (!outbound.test(code(src))) continue;
      expect(allowedDirs.some((d) => file.includes(d)), `${file} opens connections outside the reviewed modules`).toBe(true);
    }
  });
});

describe("privacy audit: the website claim stays tied to this audit", () => {
  it("documents how to change the audit lists", () => {
    // Recordatorio ejecutable: la afirmación del sitio (data-claim="no-telemetry") depende de esta prueba.
    expect(ALLOWED_TAURI_PLUGINS).toEqual(["tauri-plugin-notification", "tauri-plugin-single-instance"]);
    expect(ALLOWED_PERMISSIONS).toEqual(["core:default", "notification:default"]);
  });
});
