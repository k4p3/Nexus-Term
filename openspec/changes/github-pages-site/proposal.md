# Propuesta: Sitio Web de NexusTerm en GitHub Pages

## 1. Resumen Ejecutivo
Crear un sitio estático y bilingüe (español/inglés) publicado en GitHub Pages que **promocione** NexusTerm y **explique cómo se usa**, reutilizando el contenido, los iconos y el registro de atajos que ya existen en el repositorio. URL prevista: `https://k4p3.github.io/Nexus-Term/`.

## 2. Motivación y Contexto
- Toda la información pública vive hoy en `README.md`, `README.es.md` y `docs/FEATURES_MANUAL.md`: útil para desarrolladores, poco atractivo para usuarios finales que llegan desde un buscador o una red social.
- El repositorio ya tiene `public/social-preview.png`, `public/favicon.ico` e iconos en `src-tauri/icons/`, pero ninguna página donde mostrarlos.
- No existen capturas de pantalla de la aplicación, por lo que las imágenes del sitio serán maquetas HTML/CSS con los colores reales del tema `tokyo-night`.

## 3. Alcance del Cambio

### Dentro de Alcance (In Scope)
- Carpeta `site/` con HTML/CSS estático **sin build ni dependencias nuevas**: página de inicio, guía de uso y tabla de atajos, en `es/` y `en/`, más una raíz que redirige según el idioma del navegador.
- Maquetas HTML/CSS de la terminal, el selector de historial, los paneles divididos y la bóveda, con huecos sustituibles por capturas reales.
- `404.html`, `robots.txt`, `sitemap.xml`, metadatos (`description`, `hreflang`, Open Graph) y `.nojekyll`.
- Script `scripts/prepare-site.sh` que copia al sitio los recursos existentes (`public/social-preview.png`, `public/favicon.ico`, `src-tauri/icons/128x128@2x.png`) sin duplicarlos en git.
- Workflow `.github/workflows/pages.yml` que publica `site/` en GitHub Pages.
- Prueba automatizada Vitest que valida paridad es/en, presencia de todos los atajos, enlaces internos, metadatos y ausencia de recursos externos.
- Enlace y *badge* al sitio en `README.md`/`README.es.md` y entrada en `CHANGELOG.md`.

### Fuera de Alcance (Out of Scope)
- Dominio propio, analíticas, comentarios, blog y buscador.
- Capturas reales de la aplicación (solo se dejan los huecos preparados).
- Generadores de sitios (VitePress, Astro…) o reutilizar el frontend Vue de la aplicación.
- Cualquier cambio en la aplicación (`src/`, `src-tauri/`).

## 4. Capacidades Afectadas
- **`project-website`** (nueva): contenido, idiomas, privacidad, validación y despliegue del sitio.
- Ninguna capacidad existente de la aplicación se modifica.

## 5. Cumplimiento de Licencias FOSS (GNU GPLv3)
No se añade ningún crate, paquete npm, fuente tipográfica ni recurso de terceros. El sitio usa únicamente HTML/CSS propios, las fuentes del sistema y los iconos del propio proyecto (GPLv3). Las *actions* de GitHub usadas en el workflow son de GitHub (`actions/*`) y se fijan por versión; no se distribuyen con el software.

## 6. Riesgos
- **Información de instalación desactualizada**: el README menciona AUR y Flathub; el sitio solo debe listar canales realmente publicados. Mitigación: confirmarlo con el mantenedor antes de publicar y centralizar los enlaces en un único bloque por idioma.
- **Duplicación de contenido** con README/manual: aumenta el mantenimiento. Mitigación: la prueba de documentación comprueba que cada atajo registrado aparece en el sitio, y los textos largos se enlazan al manual en lugar de copiarse.
- **Maquetas que no reflejen la aplicación real**: se etiquetan como ilustraciones y se usan los colores del tema real; se sustituirán por capturas.
- **Publicación accidental**: el workflow solo se ejecuta en `main`; la fuente de Pages ("GitHub Actions") la activa manualmente el mantenedor.
