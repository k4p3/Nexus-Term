# Delta Spec: Salto Directo a Pestaña

## ADDED Requirements

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
