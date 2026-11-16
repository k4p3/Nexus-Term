# Diseño Técnico: Sitio Web de NexusTerm

## 1. Estructura
```
site/
  index.html                  # redirección por idioma (JS) + enlaces <noscript>
  404.html  robots.txt  sitemap.xml  .nojekyll
  assets/
    style.css                 # tokens en :root; tema oscuro por defecto; prefers-color-scheme: light
    site.js                   # solo comodidades: botón "copiar" y recuerdo del idioma
    img/                      # generado por scripts/prepare-site.sh (no versionado)
  en/{index,guide,shortcuts}.html
  es/{index,guia,atajos}.html
```
`site/assets/img/` se añade a `.gitignore`. Las rutas son **relativas** (el sitio vive en `/Nexus-Term/`, no en la raíz del dominio).

## 2. Diseño visual
- Paleta tomada del tema `tokyo-night` (`src/types/themes.ts`): fondo `#1a1b26`, texto `#a9b1d6`, acento azul `#7aa2f7`, verde `#9ece6a`, rojo `#f7768e`, amarillo `#e0af68`. Variables CSS en `:root`, redefinidas bajo `@media (prefers-color-scheme: light)`.
- Tipografía: pila de fuentes del sistema (`system-ui`, y `ui-monospace` para código y `<kbd>`); sin webfonts.
- Diseño móvil primero, *gutter* de 16 px, sin desbordamiento horizontal a 375 px; contraste AA; foco visible; un único `<h1>` por página; *landmarks* `header/nav/main/footer`.
- **Maquetas**: `<figure class="shot" data-slot="terminal|history|splits|vault" role="img" aria-label="…">` construidas con `div` y CSS. Cada una lleva una etiqueta "Ilustración / Illustration". Para sustituirla por una captura basta cambiar el `<figure>` por un `<img>` con la misma clase.

## 3. Contenido
| Página | Fuente del contenido |
|---|---|
| Inicio / Home | resumen, características e instalación de `README.md` y `README.es.md` |
| Guía / Guide | `docs/FEATURES_MANUAL.md` (secciones 1–4), resumido en pasos |
| Atajos / Shortcuts | tabla del README, validada contra `SHORTCUTS` |
No se copian textos largos: la guía enlaza al manual completo en el repositorio. Los bloques de instalación se limitan a los canales confirmados por el mantenedor.

## 4. Recursos reutilizados
`scripts/prepare-site.sh` (bash, `set -euo pipefail`) crea `site/assets/img/` y copia `public/social-preview.png`, `public/favicon.ico` y `src-tauri/icons/128x128@2x.png` (renombrado `logo.png`). Falla con un mensaje claro si falta algún origen. Se usa igual en local y en el workflow.

## 5. Despliegue (`.github/workflows/pages.yml`)
- Disparadores: `push` a `main` con rutas `site/**`, `public/**`, `src-tauri/icons/**`, `scripts/prepare-site.sh`, el propio workflow; y `workflow_dispatch`.
- `permissions: contents: read, pages: write, id-token: write`; `concurrency: group: pages, cancel-in-progress: false`.
- Pasos: `actions/checkout` → `bash scripts/prepare-site.sh` → `actions/configure-pages` → `actions/upload-pages-artifact` (`path: site`) → `actions/deploy-pages` (entorno `github-pages`). Versiones fijadas.
- Requisito manual: *Settings → Pages → Source: GitHub Actions*.

## 6. SEO y compartición
`<title>` y `<meta name="description">` únicos por página, `<link rel="alternate" hreflang>` (`es`, `en`, `x-default`), Open Graph y Twitter Card con imagen absoluta `https://k4p3.github.io/Nexus-Term/assets/img/social-preview.png`, `sitemap.xml` y `robots.txt` con la URL absoluta del mapa.

## 7. Estrategia de pruebas (`src/utils/site.docs.test.ts`, Vitest + `node:fs`)
1. Mismo conjunto de páginas en `es/` y `en/` (según una tabla de equivalencias explícita).
2. Todos los atajos de `SHORTCUTS` aparecen (`formatShortcut`) en la página de atajos de cada idioma, normalizando `<kbd>` como en `shortcuts.docs.test.ts`.
3. Todos los `href`/`src` locales apuntan a archivos existentes (ignorando los de `assets/img/`, generados por el script).
4. Cada página tiene `lang`, `<title>` único, `meta description`, un solo `<h1>` y el par `hreflang`.
5. Ningún `<script src>`, `<link rel=stylesheet>`, `<img src>` ni `url()` de CSS apunta a un dominio externo.
6. `404.html`, `robots.txt`, `sitemap.xml` y `.nojekyll` existen; el sitemap solo lista páginas existentes.
