# system-tray Specification

## Purpose
Proporciona la integración nativa con el área de notificación y bandeja del sistema (System Tray / StatusNotifierItem en Linux/KDE Plasma, Windows y macOS), permitiendo minimizar la ventana a segundo plano sin interrumpir conexiones activas y controlar la visibilidad mediante menú contextual y atajos de ratón.

## Requirements

### Requirement: Native System Tray Icon
The application SHALL register a native tray icon in the operating system's system tray (StatusNotifierItem on Linux / KDE Plasma, System Tray on Windows, and Menu Bar item on macOS).

#### Scenario: Tray icon creation at startup
- **WHEN** the application starts up
- **THEN** it SHALL register a tray icon using the official NexusTerm icon
- **AND** set a tooltip reading "NexusTerm - Gestor SSH y Terminal"
- **AND** attach a native context menu containing "Mostrar NexusTerm" and "Salir".

#### Scenario: Toggle window visibility on tray click
- **WHEN** the user left-clicks the system tray icon
- **THEN** if the window is currently visible, the application SHALL hide it
- **AND** if the window is hidden or minimized, the application SHALL restore, unminimize, and focus it.

---

### Requirement: Close-to-Tray Window Interception
The application SHALL intercept the window close request and hide the window instead of terminating the process when `close_to_tray` is enabled.

#### Scenario: Hide window on close button click
- **WHEN** the user clicks the window close button (`X`) or presses Alt+F4
- **AND** `close_to_tray` is enabled in application settings
- **THEN** the system SHALL prevent window destruction
- **AND** hide the window from the taskbar while keeping background SSH tunnels, terminal multiplexer actors, and SFTP transfers running.

#### Scenario: Terminate application via tray context menu
- **WHEN** the user clicks "Salir" from the system tray context menu
- **THEN** the system SHALL cleanly terminate the application and exit the process.

---

### Requirement: Configurable Close-to-Tray Behavior
The user SHALL be able to configure whether closing the window minimizes to the tray or terminates the application.

#### Scenario: Update close-to-tray preference
- **WHEN** the user toggles "Minimizar a la bandeja al cerrar" in the General Settings
- **THEN** the preference is saved to SQLite `settings` table
- **AND** applied immediately to window close events without requiring an application restart.
