# Delta Spec: Atajo del Autocompletado

## ADDED Requirements

### Requirement: Autocomplete Shortcut
The application SHALL provide the terminal-context shortcut `Ctrl+Space` to toggle the autocomplete popup, and SHALL list it in the shortcut cheat sheet.

#### Scenario: Shortcut toggles the popup
- **WHEN** the user presses `Ctrl+Space` in a terminal pane on the normal screen
- **THEN** the autocomplete popup opens, and pressing it again closes it
- **AND** the key event is not forwarded to the shell.

#### Scenario: No conflict with Quick Select
- **WHEN** the shortcut registry is validated
- **THEN** `Ctrl+Space` does not collide with `Ctrl+Shift+Space` (Quick Select) or any other shortcut.
