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

### Requirement: Jump To Tab Shortcuts
The application SHALL provide the global shortcuts `Alt+1` to `Alt+8` that activate the tab at that position, and `Alt+9` that activates the last tab, and SHALL list them in the shortcut cheat sheet.

#### Scenario: Jump to an existing position
- **WHEN** the user presses `Alt+3` and at least three tabs are open
- **THEN** the third tab becomes active
- **AND** the key event is not forwarded to the shell.

#### Scenario: Position does not exist
- **WHEN** the user presses `Alt+5` and fewer than five tabs are open
- **THEN** the active tab does not change.

#### Scenario: Alt+9 selects the last tab
- **WHEN** the user presses `Alt+9`
- **THEN** the last tab becomes active, regardless of how many tabs are open.

#### Scenario: No conflict with other shortcuts
- **WHEN** the shortcut registry is validated
- **THEN** none of the `Alt+1..9` combinations collides with another shortcut, including the `Alt+Arrow` pane focus shortcuts.

### Requirement: Autocomplete Shortcut
The application SHALL provide the terminal-context shortcut `Ctrl+Space` to toggle the autocomplete popup, and SHALL list it in the shortcut cheat sheet.

#### Scenario: Shortcut toggles the popup
- **WHEN** the user presses `Ctrl+Space` in a terminal pane on the normal screen
- **THEN** the autocomplete popup opens, and pressing it again closes it
- **AND** the key event is not forwarded to the shell.

#### Scenario: No conflict with Quick Select
- **WHEN** the shortcut registry is validated
- **THEN** `Ctrl+Space` does not collide with `Ctrl+Shift+Space` (Quick Select) or any other shortcut.
