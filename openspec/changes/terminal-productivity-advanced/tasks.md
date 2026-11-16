# Tasks: Productividad Avanzada de la Terminal

## 1. Spike y Dependencias
- [x] 1.1 Añadir `@xterm/addon-unicode11@0.8`, `addon-clipboard@0.1`, `addon-image@0.8` y `addon-ligatures@0.9`; verificar licencias del árbol transitivo.
- [x] 1.2 Spike: compatibilidad de `addon-image` y `addon-ligatures` con el renderizador WebGL; decidir el comportamiento de respaldo.

## 2. Backend Rust
- [x] 2.1 Migración SQLite `command_history` (cifrado con `VaultKey`, cascada por *trigger*) y `session_layout`.
- [x] 2.2 Implementar `history_record/search/delete/clear` con exclusiones y deduplicación.
- [x] 2.3 Implementar `session_layout_save/get/clear` y registrar los comandos en `lib.rs`.
- [x] 2.4 Añadir las nuevas preferencias a `AppSettings` (defaults y saneado de `restore_sessions`).
- [x] 2.5 Pruebas: texto nunca en claro en SQLite, deduplicación, exclusiones, cascada al borrar host, bóveda bloqueada, layout y settings antiguos.

## 3. Bloques de Comandos
- [x] 3.1 Crear `BlockTracker` basado en markers y migrar el manejador OSC 133 de `TerminalPane.vue`.
- [x] 3.2 Decoraciones de margen (✓/✗ y duración), selección de bloque y acciones copiar/repetir.
- [x] 3.3 Búsqueda acotada a un bloque.
- [x] 3.4 Pruebas Vitest de `BlockTracker`, incluido el recorte de *scrollback*.

## 4. Historial por Host
- [x] 4.1 Servicio y store de historial; captura del comando al terminar (`OSC 133;D`) con filtros de exclusión.
- [x] 4.2 `HistoryPicker.vue` (búsqueda difusa, `Enter` inserta, `Ctrl+Enter` ejecuta) con snippets integrados.
- [x] 4.3 Gestión desde ajustes (borrar host/todo) y pruebas Vitest de filtros y *ranking*.

## 5. Instant Replay
- [x] 5.1 `ReplayBuffer` con límites de tiempo y tamaño, y pruebas.
- [x] 5.2 Integración en el flujo de salida del panel y vaciado en bloqueo/cierre.
- [x] 5.3 `InstantReplayModal.vue` con línea de tiempo y terminal de solo lectura.

## 6. Restauración de Sesiones
- [x] 6.1 Serialización/deserialización del layout (sin datos sensibles) con pruebas.
- [x] 6.2 Guardado con *debounce* y restauración tras `vault_unlock` (`ask`/`auto`/`off`).
- [x] 6.3 Paneles pendientes con conexión diferida; manejo de hosts inexistentes, shells locales y paneles RDP/VNC.
- [x] 6.4 Diálogo de restauración.

## 7. Addons y Preferencias
- [x] 7.1 Cargar `unicode11` y proveedor OSC 52 solo escritura con límite de 1 MiB.
- [x] 7.2 Cargar `image` y `ligatures` según preferencias con *fallback* según el spike.
- [x] 7.3 Sección de preferencias en `SettingsModal.vue` y cadenas i18n (es/en).
- [x] 7.4 Registrar los atajos `Ctrl+Shift+R`, `Ctrl+Shift+H` y `Ctrl+Shift+Y` y añadirlos a la paleta.

## 8. Documentación
- [x] 8.1 Actualizar `README.md` y `README.es.md`.
- [x] 8.2 Actualizar `docs/FEATURES_MANUAL.md` (secciones y tabla de atajos).
- [x] 8.3 Actualizar `CHANGELOG.md` y `docs/ROADMAP.md`; ejecutar la prueba de consistencia de documentación.

## 9. Verificación
- [x] 9.1 `cd src-tauri && cargo test` y `cargo clippy` sin avisos. _(95 tests correctos; clippy no reporta avisos en el código de este cambio; quedan avisos previos en `sftp`, `ssh_config`, `telemetry`, `tunnels` y en tests antiguos de `settings.rs`.)_
- [x] 9.2 `pnpm test`, `vue-tsc --noEmit` y `vite build` sin errores.
- [ ] 9.3 Prueba manual: bloques tras llenar el *scrollback*, historial entre sesiones, *replay* tras `clear`, restauración con hosts SSH/RDP/VNC, OSC 52 desde `tmux`, imágenes sixel.
- [x] 9.4 `openspec validate`.
