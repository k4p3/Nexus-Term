# Design: Unified App-Wide Theming

## Context

Actualmente NexusTerm almacena el `theme_id` en `settings.store.ts` y lo aplica únicamente a la instancia de `xterm.js` mediante la propiedad `theme: ITheme`. La interfaz gráfica en Vue 3 contiene clases de Tailwind estáticas (`bg-slate-950`, `bg-slate-900`, `border-slate-800`, `text-slate-400`, etc.), lo que provoca que al cambiar a temas con matices visuales específicos (*Dracula*, *Nord*, *Catppuccin*, *One Dark* o *Tokyo Night*) la interfaz permanezca fija en tonos slate.

## Goals / Non-Goals

**Goals:**
- Establecer un sistema de tokens de diseño semánticos inyectados dinámicamente como variables CSS en `document.documentElement`.
- Definir paletas de interfaz completas para los 6 temas integrados en `src/types/themes.ts`.
- Diseñar un generador algorítmico reactivo que derive automáticamente una paleta de UI armónica para temas personalizados importados por el usuario.
- Refactorizar las áreas estructurales de la UI (cabecera, barra lateral, barra de pestañas, modales, cajón de snippets y split panes) para consumir los tokens de diseño unificados.

**Non-Goals:**
- Diseñar un editor visual complejo para crear temas personalizados elemento por elemento (los temas personalizados se importan por JSON estándar).
- Modificar el protocolo de backend Tauri IPC (el cambio es estrictamente en la capa de presentación y persistencia de frontend).

## Decisions

### Decisión 1: Variables CSS en `:root` vs Clases de Tema Precompiladas
- **Elección**: Inyectar propiedades CSS personalizadas (`--theme-*`) en `document.documentElement.style`.
- **Razón**: Permite la aplicación en caliente instantánea sin recarga de página y otorga soporte nativo para temas personalizados importados en tiempo de ejecución, lo cual sería imposible con clases estáticas precompiladas de Tailwind.

### Decisión 2: Tokens Semánticos de Interfaz
Se declaran los siguientes tokens en `src/style.css`:
```css
:root {
  --theme-bg-app: #0f172a;
  --theme-bg-surface: #1e293b;
  --theme-bg-header: #0f172a;
  --theme-bg-active: #334155;
  --theme-border: #334155;
  --theme-text-main: #f8fafc;
  --theme-text-muted: #94a3b8;
  --theme-accent: #06b6d4;
  --theme-accent-hover: #0891b2;
}
```
Y clases utilitarias de soporte:
- `.bg-theme-app` → `background-color: var(--theme-bg-app)`
- `.bg-theme-surface` → `background-color: var(--theme-bg-surface)`
- `.bg-theme-header` → `background-color: var(--theme-bg-header)`
- `.bg-theme-active` → `background-color: var(--theme-bg-active)`
- `.border-theme` → `border-color: var(--theme-border)`
- `.text-theme-main` → `color: var(--theme-text-main)`
- `.text-theme-muted` → `color: var(--theme-text-muted)`
- `.text-theme-accent` → `color: var(--theme-accent)`
- `.bg-theme-accent` → `background-color: var(--theme-accent)`

### Decisión 3: Estructura de Datos en `src/types/themes.ts`
```typescript
export interface UiThemePalette {
  bgApp: string;
  bgSurface: string;
  bgHeader: string;
  bgActive: string;
  border: string;
  textMain: string;
  textMuted: string;
  accent: string;
  accentHover: string;
}

export interface TerminalTheme {
  id: string;
  name: string;
  theme: ITheme;
  ui?: UiThemePalette;
}
```

### Decisión 4: Generador de Paleta para Temas Personalizados
Para temas sin `ui` explícito, se derivan los valores a partir del objeto `ITheme`:
- `bgApp`: `theme.background`
- `bgSurface`: Un tono ligeramente más iluminado o contrastado basado en `theme.black` o `theme.background`.
- `bgHeader`: Un tono ligeramente más oscuro que `bgApp`.
- `border`: `theme.brightBlack` o `theme.selectionBackground`.
- `textMain`: `theme.foreground`.
- `textMuted`: `theme.white` o `theme.brightBlack`.
- `accent`: `theme.cyan` || `theme.blue` || `theme.magenta`.

## Risks / Trade-offs

- **[Riesgo] Contraste o legibilidad en modales con fondo translúcido**:
  - *Mitigación*: Los tokens de superficie `bg-theme-surface` tendrán valores sólidos con alta opacidad para garantizar lectura perfecta de textos en formularios e inputs.
- **[Riesgo] Interferencia con WebGL de xterm.js**:
  - *Mitigación*: Las instancias de xterm continúan recibiendo su `ITheme` nativo intacto; las variables CSS solo impactan al árbol DOM circundante.
