# Delta Spec: Atajos de Cambio de Pestaña

## ADDED Requirements

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
