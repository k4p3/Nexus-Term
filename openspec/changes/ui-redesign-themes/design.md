## Context

Existen 9 variables `--theme-*` en `src/style.css` aplicadas por `applyThemeToDom()` en `settings.store.ts`. La paleta viene de `src/types/themes.ts` (`PRESET_THEMES`, `deriveUiPalette`). Los ajustes se guardan como JSON en `app_settings` (SQLite) vía `src-tauri/src/settings.rs`. Los temas personalizados solo viven en memoria.

## Goals / Non-Goals

**Goals:** tokens completos y conmutables, modo claro/oscuro/sistema, persistencia de temas personalizados, rediseño coherente, accesibilidad (contraste AA, foco visible, `prefers-reduced-motion`).
**Non-Goals:** cambios en el protocolo SSH/SFTP, bóveda o IPC de terminal; editor visual de temas.

## Decisions

1. **Tokens en `@theme inline`**: `--color-app|surface|elevated|header|active|border|fg|fg-muted|accent|accent-hover|on-accent|success|warning|danger|info|overlay` referenciando `var(--theme-*)`. Permite `hover:`, `/50` y `focus-visible:`. Los alias `.bg-theme-*` se mantienen durante la migración y se eliminan al final.
2. **`UiThemePalette` ampliada** con los nuevos tokens y `mode: 'dark' | 'light'`. `deriveUiPalette` calcula `mode` por luminancia y genera los semánticos con contraste AA.
3. **Temas**: Nexus Slate (defecto, `#0f1115` / `#161a20` / acento `#6b8cff`), Nexus Paper (claro, acento `#3f5fe0`), Solarized Light, y los 6 existentes completados. `theme_id` por defecto pasa a `nexus-slate`; ids antiguos siguen válidos.
4. **Persistencia**: nuevo campo `custom_themes: Vec<CustomTheme>` en `Settings` con `#[serde(default)]`; sin migración SQL (JSON). Un `theme_id` `custom-*` inexistente cae al tema por defecto. Nuevo `appearance_mode: system | manual`, `theme_light_id`, `theme_dark_id`, `ui_density`.
5. **Tipografía**: `@fontsource-variable/inter` y `@fontsource-variable/jetbrains-mono` (OFL-1.1, compatible con distribución GPLv3), importadas en `style.css`.
6. **Primitivas** `BaseModal`, `BaseButton`, `IconButton`, `EmptyState` en `src/components/common/`, cargadas con `defineAsyncComponent` desde los contenedores condicionales (regla de lazy loading).
7. **Guard de regresión**: test que falla si `src/components` contiene `neutral-|slate-|zinc-|gray-` o hex literales.

## Risks / Trade-offs

- Migración masiva de 26 archivos: riesgo de regresiones visuales → migración por tandas con revisión visual por tema.
- Temas claros y xterm: ANSI claros deben revisarse (colores "bright white" ilegibles) → paleta ANSI específica por tema claro.
- Compatibilidad hacia atrás de settings → `serde(default)` y tests Rust con JSON antiguo.
