# runtime-performance Specification

## Purpose
Establece las directrices y requerimientos técnicos para la gestión eficiente del consumo de memoria RAM en el arranque, la carga asíncrona bajo demanda de subsistemas pesados y la optimización del tamaño del binario compilado.

## ADDED Requirements

### Requirement: Asynchronous Subsystem Loading (Lazy Loading)
The frontend application SHALL lazily load secondary view components and configuration modals only when first requested by user interaction, preventing them from consuming JavaScriptCore heap memory at initial startup.

#### Scenario: Startup with locked or unlocked vault
- **WHEN** the application initializes
- **THEN** it SHALL only load essential components (`VaultUnlockScreen` or `TerminalWorkspace` with `HostTreeSidebar`)
- **AND** it SHALL NOT parse or instantiate modals (`SettingsModal`, `SnippetDrawer`, `PortForwardManager`, `SftpSidebar`, `TransferQueue`, `ShortcutsModal`, `RestoreSessionsModal`) into memory until their respective display flag is triggered.

#### Scenario: Opening settings modal for the first time
- **WHEN** the user opens the settings window via menu or keyboard shortcut (`Ctrl+,`)
- **THEN** the system SHALL dynamically import and render `SettingsModal`
- **AND** preserve the component instance or state without blocking the terminal event loop.

---

### Requirement: Demand-driven Terminal Addon Initialization
The terminal subsystem SHALL only instantiate heavy terminal addons when actively configured or utilized by the user.

#### Scenario: Ligatures addon conditional activation
- **WHEN** a terminal pane is created
- **AND** font ligatures are disabled in user settings
- **THEN** the `LigaturesAddon` SHALL NOT be instantiated, avoiding unnecessary memory and font glyph cache allocation.

#### Scenario: Image addon deferred loading
- **WHEN** a terminal pane is mounted
- **THEN** `ImageAddon` SHALL be loaded lazily or constrained to memory storage limits configured in settings.

---

### Requirement: Production Binary Size Optimization
The Rust backend build configuration SHALL produce a release executable stripped of debug symbols and optimized via Link-Time Optimization (LTO).

#### Scenario: Building the production binary
- **WHEN** building NexusTerm with `cargo build --release` or `tauri build`
- **THEN** the compiler SHALL apply Link-Time Optimization (`lto = true`)
- **AND** strip all DWARF debug symbols (`strip = true`)
- **AND** configure single codegen unit (`codegen-units = 1`)
- **AND** set panic abort strategy (`panic = "abort"`)
- **AND** produce an executable file significantly smaller than unstripped debug builds (< 25 MB).
