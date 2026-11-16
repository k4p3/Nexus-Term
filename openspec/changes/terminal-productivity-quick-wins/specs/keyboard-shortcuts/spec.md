# Delta Spec: Registro Único de Atajos de Teclado

## ADDED Requirements

### Requirement: Single Shortcut Registry
The application SHALL define every terminal and workspace keyboard shortcut in a single registry that is consumed by the key handler, the command palette and the shortcut cheat sheet.

#### Scenario: Registered shortcut triggers its action
- **WHEN** the user presses a shortcut defined in the registry while its context is active
- **THEN** the associated action runs
- **AND** the key event is not forwarded to the shell.

#### Scenario: Conflicting registrations are rejected
- **WHEN** two registry entries declare the same key combination in overlapping contexts
- **THEN** the unit tests MUST fail.

#### Scenario: Plain control keys are never intercepted
- **WHEN** the user presses `Ctrl+<letter>` without `Shift` or `Alt`, other than the existing global shortcuts
- **THEN** the key is delivered to the shell unchanged.

---

### Requirement: Shortcut Cheat Sheet
The application SHALL provide a cheat sheet listing all shortcuts grouped by context, opened with `Ctrl+Shift+/` or from the command palette.

#### Scenario: Open the cheat sheet
- **WHEN** the user presses `Ctrl+Shift+/`
- **THEN** a modal lists every registered shortcut with its description and context
- **AND** pressing `Escape` closes it.

---

### Requirement: Documented Shortcuts
Every shortcut in the registry MUST be listed in `README.md`, `README.es.md` and `docs/FEATURES_MANUAL.md`.

#### Scenario: Documentation drift is detected
- **WHEN** a shortcut is added to the registry without being documented
- **THEN** the documentation consistency test MUST fail.
