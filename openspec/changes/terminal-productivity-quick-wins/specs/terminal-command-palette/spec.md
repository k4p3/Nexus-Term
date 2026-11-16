# Delta Spec: Paleta de Comandos de la Terminal

## ADDED Requirements

### Requirement: Terminal Command Palette
The application SHALL provide a command palette, opened with `Ctrl+Shift+P`, that lists terminal and workspace actions and runs the selected one.

#### Scenario: Fuzzy search
- **WHEN** the user types part of an action name or its category
- **THEN** the list is filtered with fuzzy matching, ranking prefix and word-start matches first.

#### Scenario: Run an action
- **WHEN** the user presses `Enter` on an action
- **THEN** the palette closes and the action runs on the active pane.

#### Scenario: Show shortcuts
- **WHEN** an action has a registered shortcut
- **THEN** the palette shows that shortcut next to the action.

#### Scenario: Context-aware actions
- **WHEN** an action does not apply to the active pane (e.g. terminal-only action on a remote desktop pane)
- **THEN** it MUST be hidden or disabled.

#### Scenario: Insert a snippet
- **WHEN** the user selects a snippet from the palette
- **THEN** it is inserted into the active prompt using the existing parameter flow.

#### Scenario: Keyboard-only operation
- **WHEN** the palette is open
- **THEN** `↑`/`↓` navigate, `Enter` runs and `Escape` closes without running anything.
