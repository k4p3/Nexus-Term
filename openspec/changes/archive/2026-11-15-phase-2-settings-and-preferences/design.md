# Design

## Context

En la Fase 1 establecimos los cimientos funcionales de NexusTerm (bóveda cifrada, inventario y emulador de terminal). En esta Fase 2, se añade la capa de personalización y preferencias del usuario para que cada desarrollador ajuste la apariencia visual y comportamiento de sus terminales a su gusto.

## Goals / Non-Goals

**Goals:**
- Permitir persistir preferencias de usuario en SQLite (`app_settings`) con valores predeterminados seguros y autodescubrimiento de fuentes Nerd Font.
- Proveer aplicación reactiva en caliente en `xterm.js` (`term.options`) para que cualquier cambio de fuente, tamaño o tema se vea al instante sin desconectar sesiones.
- Centralizar en una interfaz limpia el cambio de contraseña maestra y opciones de shell.

**Non-Goals:**
- No se implementa aún sincronización remota de configuraciones entre múltiples máquinas (se abordará en la Fase 5 junto con la bóveda).

## Decisions

### 1. Almacenamiento en SQLite (`app_settings`)
- **Decisión**: Crear una tabla `app_settings` que guarda un documento JSON serializado (`settings_json`).
- **Racional**: La configuración de la interfaz (fuente, temas, cursor) es un documento estructurado no sensible que evoluciona rápidamente. Almacenarlo como JSON tipado en SQLite simplifica las migraciones y permite retrocompatibilidad con campos nuevos.

### 2. Estructura de `AppSettings`
```typescript
export interface AppSettings {
  // General & i18n
  locale: string; // "en" | "es" | código IETF

  // Terminal Appearance
  font_family: string;
  font_size: number;
  line_height: number;
  cursor_style: "block" | "bar" | "underline";
  cursor_blink: boolean;
  theme_id: string; // "tokyo-night" | "dracula" | "one-dark" | "catppuccin" | "nord" | "breeze-dark"

  // Shell & Behavior
  default_shell: string | null; // null = auto detect

  // Security
  auto_lock_minutes: number; // 0 = deshabilitado
}
```

### 3. Paletas de Colores Predefinidas
Se definirán paletas ANSI de 16 colores cuidadosamente seleccionadas para:
- **Tokyo Night** (predeterminado moderno azul oscuro/cian)
- **One Dark** (clásico equilibrado de Atom/VS Code)
- **Dracula** (alto contraste violeta/rosa)
- **Catppuccin Macchiato** (tonos pastel suaves)
- **Nord** (tonos árticos fríos)
- **KDE Breeze Dark** (integración visual óptima con Manjaro KDE Plasma)

### 4. Reactividad en `TerminalPane.vue`
`TerminalPane.vue` se suscribe a los cambios del `useSettingsStore()`. Al detectar cambios en `settings`, actualiza directamente:
```ts
term.options.fontFamily = settings.font_family;
term.options.fontSize = settings.font_size;
term.options.lineHeight = settings.line_height;
term.options.cursorStyle = settings.cursor_style;
term.options.cursorBlink = settings.cursor_blink;
term.options.theme = getThemeById(settings.theme_id);
fitAddon.fit();
```

### 5. Arquitectura de Internacionalización (`vue-i18n` + JSON Estándar)
- **Biblioteca**: `vue-i18n` (v10+ para Vue 3 Composition API).
- **Estructura**:
  - `src/locales/en.json`: Diccionario base en inglés con estructura anidada modular (`common`, `vault`, `hosts`, `terminal`, `settings`).
  - `src/locales/es.json`: Diccionario completo en español.
  - `src/locales/index.ts`: Configuración con `fallbackLocale: 'en'`.
- **Extensibilidad Comunitaria**: Cualquier usuario o colaborador puede añadir una nueva traducción agregando `src/locales/<código>.json` o cargando un archivo JSON dinámicamente desde el panel de ajustes con `i18n.global.setLocaleMessage(...)`.

## Risks / Trade-offs

- **[Riesgo] Redimensionado abrupto de terminal al cambiar de fuente** → **Mitigación**: Invocar `fitAddon.fit()` y notificar el nuevo tamaño `(cols, rows)` al backend mediante `resize_session` inmediatamente tras modificar `font_size` o `font_family`.
