## 1. Tokens y base visual
- [x] 1.1 Registrar tokens en `@theme inline` en `src/style.css` y mantener alias temporales
- [x] 1.2 Añadir fuentes Inter y JetBrains Mono (licencia OFL-1.1 verificada)
- [x] 1.3 Foco visible global, `prefers-reduced-motion` y escala de radios/densidad

## 2. Temas
- [x] 2.1 Ampliar `UiThemePalette` con semánticos y `mode`; actualizar `deriveUiPalette`
- [x] 2.2 Añadir Nexus Slate, Nexus Paper, Solarized Light y completar los 6 existentes
- [x] 2.3 Actualizar `themes.test.ts` (conteo, tokens completos, contraste AA)

## 3. Persistencia y store
- [x] 3.1 Campos `custom_themes`, `appearance_mode`, `theme_light_id`, `theme_dark_id`, `ui_density` en `settings.rs` con `serde(default)` y tests Rust
- [x] 3.2 Actualizar `settings.service.ts` y tipos espejo
- [x] 3.3 `applyThemeToDom` con todos los tokens y `color-scheme`; modo sistema con `matchMedia`
- [x] 3.4 Crear `settings.store.test.ts`

## 4. Primitivas y shell principal
- [x] 4.1 Crear `BaseModal`, `BaseButton`, `IconButton`, `EmptyState`
- [x] 4.2 Rediseñar `App.vue`, `HostTreeSidebar`, pestañas (`TerminalWorkspace`), `SplitPaneNode`/`TerminalPane`, `TelemetryBar`
- [x] 4.3 Rediseñar `VaultUnlockScreen` y `VaultUnlockModal`
- [x] 4.4 Rediseñar `SettingsModal` con sección Apariencia (tarjetas de vista previa, densidad, modo sistema)

## 5. Resto de componentes
- [x] 5.1 Migrar SFTP (`SftpSidebar`, `TransferQueue`), túneles y snippets
- [x] 5.2 Migrar modales de hosts, identidades, importación SSH y carpetas
- [x] 5.3 Migrar overlays de terminal, pickers, `ToastHost`, `CustomSelect`, `ListPicker` y remoto
- [x] 5.4 Retirar alias `.bg-theme-*` y añadir test guard anti colores fijos

## 6. Validación
- [x] 6.1 `pnpm test`, `vue-tsc --noEmit`, `vite build` y `cargo test` sin errores
- [ ] 6.2 Revisión manual en `pnpm tauri dev` con todos los temas y `openspec validate`

## 7. Internacionalización y modales
- [x] 7.1 Mover los textos fijos en español de los componentes a `en.json`/`es.json` (namespace `ui`)
- [x] 7.2 Test de paridad de idiomas y de existencia de claves `t('...')`
- [x] 7.3 Migrar el diálogo de confirmación de pegado a `BaseModal`
