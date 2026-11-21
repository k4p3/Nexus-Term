# keyboard-shortcuts Specification

## Purpose
TBD - created by archiving change shortcut-new-local-terminal. Update Purpose after archive.

## Requirements

### Requirement: New Local Terminal Shortcut
The application SHALL provide the global shortcut `Ctrl+Shift+T` (`Cmd+Shift+T` on macOS) that opens a new tab with a local terminal, and SHALL list it in the shortcut cheat sheet.

#### Scenario: Shortcut opens a local terminal
- **WHEN** the user presses `Ctrl+Shift+T` while the vault is unlocked
- **THEN** a new tab with a local terminal is created and focused
- **AND** the key event is not forwarded to the shell.

#### Scenario: Works from any focus
- **WHEN** the user presses `Ctrl+Shift+T` while a terminal pane, the sidebar or no element has focus
- **THEN** the new local terminal tab is opened.

#### Scenario: No conflict with existing shortcuts
- **WHEN** the shortcut registry is validated
- **THEN** no other shortcut uses the same combination as `Ctrl+Shift+T`.
