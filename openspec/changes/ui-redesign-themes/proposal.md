## Why

La interfaz usa Tokyo Night con solo 9 variables `--theme-*` y una adopción parcial: ~383 clases `neutral/slate/zinc` y ~237 colores hex fijos en 26 componentes impiden que los temas cambien toda la UI. No existe modo claro, los temas personalizados importados se pierden al reiniciar y las clases `bg-theme-*` no admiten variantes ni opacidad de Tailwind. Se busca una apariencia actual, coherente y usable, con temas conmutables.

## What Changes

- Nuevo sistema de tokens de diseño registrado en `@theme inline` (superficies, texto, acento, semánticos `success/warning/danger/info`, `overlay`, `on-accent`).
- Ampliar la paleta de interfaz con `mode` claro/oscuro y añadir temas (Nexus Slate por defecto, Nexus Paper, Solarized Light y los 6 existentes completados).
- Modo "Seguir al sistema" (`prefers-color-scheme`) y `color-scheme` dinámico.
- **Persistir temas personalizados** en la configuración (nuevo campo `custom_themes`, compatible hacia atrás).
- Tipografía autoalojada Inter + JetBrains Mono.
- Rediseño de toda la interfaz ("instrumento sobrio") migrando todos los colores fijos a tokens, con primitivas comunes (`BaseModal`, `BaseButton`, `IconButton`, `EmptyState`) cargadas con `defineAsyncComponent`.
- Sección Apariencia en Ajustes con tarjetas de vista previa, densidad y modo del sistema.

## Capabilities

### New Capabilities
- Ninguna.

### Modified Capabilities
- `app-settings`: temas claro/oscuro, modo del sistema, persistencia de temas personalizados y paleta de interfaz ampliada.

## Impact

- Frontend: `src/style.css`, `src/types/themes.ts`, `src/stores/settings.store.ts`, `src/services/settings.service.ts`, todos los componentes de `src/components/`.
- Backend: `src-tauri/src/settings.rs` (campo `custom_themes` con `serde(default)`).
- Dependencias nuevas (licencias verificadas): `@fontsource-variable/inter` (OFL-1.1) y `@fontsource-variable/jetbrains-mono` (OFL-1.1); fuentes OFL redistribuibles junto a software GPLv3.
- Sin cambios de IPC en terminal ni en bóveda.
