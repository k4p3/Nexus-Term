# Tasks: Mejoras Rápidas de Productividad de la Terminal

## 1. Registro de Atajos y Utilidades Base
- [x] 1.1 Crear `src/utils/shortcuts.ts` (registro, `matchShortcut`, `formatShortcut`) y migrar los atajos existentes sin cambiar su comportamiento.
- [x] 1.2 Refactorizar `attachCustomKeyEventHandler` de `TerminalPane.vue` para usar el registro.
- [x] 1.3 Crear `src/utils/fuzzy.ts` con pruebas.
- [x] 1.4 Pruebas de `shortcuts.ts`: sin conflictos, coincidencia por contexto, formato Linux/Windows/macOS y no interceptar `Ctrl+<letra>` simples.

## 2. Backend Rust (Preferencias y Notificaciones)
- [x] 2.1 Añadir `paste_warning`, `paste_history_size`, `notify_long_commands`, `notify_threshold_seconds` y `notify_include_command` a `AppSettings` con *clamp* y valores por defecto.
- [x] 2.2 Pruebas de `settings.rs`: defaults, JSON antiguo y *clamp*.
- [x] 2.3 Añadir `tauri-plugin-notification`, registrarlo en `lib.rs` y habilitar `notification:default`; verificar y documentar la licencia.

## 3. Funciones de Terminal
- [x] 3.1 `quick-select.ts` (`findMatches`, `assignLabels`) con pruebas de cada tipo de patrón, deduplicación y etiquetas multi-carácter.
- [x] 3.2 Modo Quick Select en `TerminalPane.vue` (decoraciones, captura exclusiva de teclado, copiar/pegar, `Escape`).
- [x] 3.3 `paste-guard.ts` con pruebas (multilínea, patrones peligrosos, caracteres de control, cero ancho, umbral de tamaño, secretos).
- [x] 3.4 Store `paste-history.store.ts` (solo memoria, límite, vaciado al bloquear, enmascarado) con pruebas.
- [x] 3.5 Interceptar `paste` y `Ctrl+Shift+V`; crear `PasteConfirmModal.vue` y selector de historial (`Ctrl+Alt+V`).
- [x] 3.6 Proveedores de enlaces de ruta e IP (`ILinkProvider`) con validación de IP y activación solo con modificador; pruebas de las expresiones.
- [x] 3.7 `TerminalLinkMenu.vue` y acción "Mostrar en SFTP" (`sftpStore.openAt`).
- [x] 3.8 `shouldNotify` y envío de notificaciones/toasts desde el manejador OSC 133 `D`; pruebas de la decisión de canal.

## 4. Paleta y Hoja de Atajos
- [x] 4.1 `TerminalCommandPalette.vue` (acciones del registro, snippets, temas, `when` por tipo de panel).
- [x] 4.2 `ShortcutsModal.vue` agrupado por contexto y atajo `Ctrl+Shift+/`.
- [x] 4.3 Sección de preferencias en `SettingsModal.vue` y cadenas i18n (es/en).

## 5. Documentación
- [x] 5.1 Actualizar `README.md` y `README.es.md` (características y tabla de atajos).
- [x] 5.2 Actualizar `docs/FEATURES_MANUAL.md` (nuevas secciones, tabla de atajos y corrección de §4.5).
- [x] 5.3 Actualizar `CHANGELOG.md` y `docs/ROADMAP.md`.
- [x] 5.4 Prueba `shortcuts.docs.test.ts` que valida que todos los atajos del registro están documentados.

## 6. Verificación
- [x] 6.1 `cd src-tauri && cargo test` y `cargo clippy` sin avisos.
- [x] 6.2 `pnpm test`, `vue-tsc --noEmit` y `vite build` sin errores.
- [ ] 6.3 Prueba manual: Quick Select, paleta, enlaces en sesión SSH y local, pegado multilínea/peligroso, notificación con la ventana sin foco en KDE Plasma.
- [x] 6.4 `openspec validate`.
