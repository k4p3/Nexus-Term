# Design: System Tray Integration & Background Persistence

## Context

En Linux con KDE Plasma (utilizando el protocolo D-Bus StatusNotifierItem), GNOME, Windows y macOS, los gestores de conexiones remotas necesitan permanecer en ejecución en segundo plano para no interrumpir túneles de puertos ni transferencias.

## Goals / Non-Goals

**Goals:**
- Integrar la bandeja del sistema nativa con `tauri::tray::TrayIconBuilder`.
- Menú contextual nativo con opciones de "Mostrar NexusTerm" y "Salir".
- Clic izquierdo en el ícono para alternar visibilidad (mostrar/ocultar y enfocar).
- Interceptar `WindowEvent::CloseRequested` para ejecutar `window.hide()` y `api.prevent_close()` cuando la opción `close_to_tray` esté activa.
- Opción configurable en `AppSettings` guardada en SQLite.

**Non-Goals:**
- No implementar menús dinámicos anidados complejos en la bandeja en esta fase (se mantiene simple, rápido y confiable con Mostrar y Salir).

## Architecture & Event Flow

```text
[Bandeja del Sistema (KDE / Windows / macOS)]
       │
       ├── Clic Izquierdo ──> Si visible: window.hide()
       │                     Si oculta:  window.show() + set_focus()
       │
       └── Menú Contextual (Clic Derecho)
             ├── "Mostrar NexusTerm" ──> window.show() + set_focus()
             └── "Salir"              ──> app.exit(0)

[Ventana Principal (X / Alt+F4)]
       │
       ▼
[WindowEvent::CloseRequested]
       │
       ├── Si close_to_tray == true:
       │     api.prevent_close() + window.hide()  (Sigue vivo en Bandeja)
       │
       └── Si close_to_tray == false:
             Cierra la aplicación normalmente
```

## Decisions

### Decisión 1: Feature `tray-icon` en Tauri v2
- Se habilita `tauri = { version = "2.12.5", features = ["tray-icon"] }` en `Cargo.toml`.
- En Linux, esto compila con `libappindicator` y soporta D-Bus SNI (*StatusNotifierItem*), el estándar oficial de KDE Plasma y escritorios modernos.

### Decisión 2: Menú con `tauri::menu::Menu` y `MenuItem`
- Se construyen los elementos de menú con IDs `"show"` y `"quit"`.
- En el manejador `on_menu_event`:
  - `"show"`: Busca la ventana con etiqueta `"main"`, llama a `show()`, `unminimize()` y `set_focus()`.
  - `"quit"`: Llama directamente a `app.exit(0)`.

### Decisión 3: Intercepción de Cierre en `on_window_event`
- En el builder de Tauri:
  ```rust
  .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
          // Consultamos configuración o default true
          let _ = window.hide();
          api.prevent_close();
      }
  })
  ```
