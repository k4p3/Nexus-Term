# Tasks: Sitio Web de NexusTerm en GitHub Pages

## 1. Base del Sitio
- [x] 1.1 Crear `site/assets/style.css` (tokens del tema `tokyo-night`, modo claro por `prefers-color-scheme`, diseño móvil, componentes: cabecera, héroe, rejilla de funciones, `<kbd>`, bloques de código, maquetas `.shot`).
- [x] 1.2 Crear `site/assets/site.js` (botón "copiar" y recuerdo del idioma; todo opcional sin JS).
- [x] 1.3 Crear `site/index.html` (redirección por idioma con alternativa `<noscript>`), `404.html`, `robots.txt`, `sitemap.xml` y `.nojekyll`.
- [x] 1.4 Crear `scripts/prepare-site.sh` y añadir `site/assets/img/` a `.gitignore`.

## 2. Contenido en Inglés
- [x] 2.1 `site/en/index.html`: héroe, funciones, seguridad, instalación (solo canales confirmados), licencia y enlaces.
- [x] 2.2 `site/en/guide.html`: guía paso a paso.
- [x] 2.3 `site/en/shortcuts.html`: tabla completa de atajos.
- [x] 2.4 Maquetas HTML/CSS (terminal con bloques, historial, paneles, bóveda) con texto alternativo.

## 3. Contenido en Español
- [x] 3.1 `site/es/index.html`, `site/es/guia.html` y `site/es/atajos.html` con paridad respecto a inglés.
- [x] 3.2 Selector de idioma y `hreflang` en todas las páginas.

## 4. Pruebas
- [x] 4.1 `src/utils/site.docs.test.ts`: paridad es/en, atajos del registro, enlaces locales, metadatos, `h1` único, sin recursos externos y archivos auxiliares.
- [x] 4.2 Comprobar que la prueba falla con un caso defectuoso (atajo ausente o enlace roto) y pasa con el sitio completo.

## 5. Publicación y Documentación
- [x] 5.1 Crear `.github/workflows/pages.yml` con permisos mínimos y versiones fijadas.
- [x] 5.2 Enlace y *badge* al sitio en `README.md` y `README.es.md`; entrada en `CHANGELOG.md`.
- [ ] 5.3 Confirmar con el mantenedor los canales de instalación realmente publicados (AUR, Flathub, Releases) y ajustar el contenido.

## 6. Verificación
- [x] 6.1 `pnpm test`, `vue-tsc --noEmit`, `vite build` y `cargo test` sin errores.
- [x] 6.2 Vista local (`prepare-site.sh` + servidor estático) revisada en Chrome a 375 px y 1280 px, tema claro y oscuro, en ambos idiomas, con enlaces y botón "copiar".
- [x] 6.3 `openspec validate`.
- [ ] 6.4 Tras fusionar en `main` y activar Pages (*Settings → Pages → Source: GitHub Actions*): el workflow termina en verde y el sitio carga con imágenes y `og:image`.
