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

### Requirement: Tab Switching Shortcuts
The application SHALL provide global shortcuts to activate the next tab (`Ctrl+Tab`, `Ctrl+PageDown`) and the previous tab (`Ctrl+Shift+Tab`, `Ctrl+PageUp`), cycling around at both ends, and SHALL list them in the shortcut cheat sheet.

#### Scenario: Next tab
- **WHEN** the user presses `Ctrl+Tab` while a tab other than the last one is active
- **THEN** the following tab becomes active
- **AND** the key event is not forwarded to the shell.

#### Scenario: Wrap around
- **WHEN** the user presses `Ctrl+Tab` on the last tab, or `Ctrl+Shift+Tab` on the first tab
- **THEN** the first tab, or the last tab respectively, becomes active.

#### Scenario: Alternative combination
- **WHEN** the user presses `Ctrl+PageDown` or `Ctrl+PageUp`
- **THEN** it behaves like `Ctrl+Tab` or `Ctrl+Shift+Tab` respectively.

#### Scenario: Single or no tab
- **WHEN** there are zero or one tabs
- **THEN** the shortcut has no effect.

#### Scenario: No conflict with pane navigation
- **WHEN** the shortcut registry is validated
- **THEN** none of these combinations collides with another shortcut, including the `Alt+Arrow` pane focus shortcuts.
