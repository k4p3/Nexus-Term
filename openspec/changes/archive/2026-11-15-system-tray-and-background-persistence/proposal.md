# Proposal: Integración con Bandeja del Sistema (System Tray) y Persistencia en Segundo Plano

## Why

NexusTerm opera tareas críticas y de larga duración en segundo plano, tales como:
- Túneles SSH y reenvío de puertos (Local, Remoto y SOCKS5).
- Sesiones de terminal multiplexadas hacia servidores remotos.
- Transferencias y descargas de archivos SFTP.
- Monitoreo de telemetría en tiempo real.

En los entornos de escritorio modernos (especialmente en Linux con **KDE Plasma**, GNOME o XFCE, así como Windows y macOS), el cierre accidental de la ventana principal destruye el proceso y desconecta de golpe todas las conexiones remotas y transferencias activas.

Incorporar un ícono nativo en la **Bandeja del Sistema (System Tray / StatusNotifierItem)** permite que la aplicación continúe ejecutándose en segundo plano de manera silenciosa y eficiente cuando la ventana se minimiza o se presiona el botón de cerrar (`X`), ofreciendo restauración instantánea con un clic y un menú contextual para abrir o salir limpiamente.

## What Changes

- **Backend Rust (`src-tauri/`)**:
  - Habilitación de la característica `tray-icon` en la dependencia de Tauri v2 (`src-tauri/Cargo.toml`).
  - Creación del `TrayIcon` en el ciclo de vida de arranque (`setup` en `src-tauri/src/lib.rs`):
    - Uso del nuevo ícono gráfico plano de la aplicación (`app.default_window_icon()`).
    - Tooltip descriptivo: `"NexusTerm - Gestor SSH y Terminal"`.
    - Menú contextual nativo con opciones:
      - `Mostrar NexusTerm`: Restaura, desminimiza y enfoca la ventana principal.
      - `Ocultar`: Oculta la ventana hacia la bandeja del sistema.
      - Separador.
      - `Salir`: Finaliza completamente la aplicación liberando todos los recursos (`app.exit(0)`).
  - Manejo del evento de clic izquierdo en el ícono de la bandeja:
    - Alterna la visibilidad de la ventana (si está visible la oculta; si está oculta la restaura y enfoca).
  - Intercepción del evento `WindowEvent::CloseRequested`:
    - En lugar de terminar el proceso, previene el cierre (`api.prevent_close()`) y oculta la ventana (`window.hide()`).
  - Comando Tauri IPC `show_main_window` y `hide_main_window` para soporte desde el frontend o atajos globales.
- **Configuración de Usuario (`AppSettings`)**:
  - Parámetro opcional en la configuración `close_to_tray: bool` (por defecto `true`) para dar al usuario el control sobre si cerrar la ventana minimiza a la bandeja o cierra la app.
- **Frontend y Ajustes**:
  - En la pestaña de configuración General (`SettingsModal.vue`), agregar la opción "Minimizar a la bandeja del sistema al cerrar".
- **Pruebas y Verificación**:
  - Pruebas unitarias en Rust para los settings con la nueva opción `close_to_tray`.
  - Pruebas en Vitest y compilación de release con los nuevos instaladores.

## Capabilities

### New Capabilities
- `system-tray`: Soporte nativo de icono en el área de notificación (System Tray), menú contextual con Mostrar/Salir, alternancia de visibilidad con un clic y persistencia de tareas en segundo plano al cerrar la ventana.

### Modified Capabilities
- `app-settings`: Adición de la preferencia de comportamiento `close_to_tray` en la configuración general de la aplicación.

## Impact

- **Backend (Rust)**:
  - `src-tauri/Cargo.toml`: Adición de `features = ["tray-icon"]` en `tauri`.
  - `src-tauri/src/lib.rs`: Inicialización de `TrayIconBuilder`, menú contextual e interceptor `CloseRequested`.
  - `src-tauri/src/settings.rs`: Campo `close_to_tray: bool`.
- **Frontend (Vue 3 / TypeScript)**:
  - `src/types/settings.ts`: Campo `close_to_tray: boolean`.
  - `src/components/settings/SettingsModal.vue`: Interruptor visual en la pestaña General.
