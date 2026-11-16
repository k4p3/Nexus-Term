# Delta Spec: Pegado Seguro e Historial de Pegado

## ADDED Requirements

### Requirement: Paste Confirmation
The terminal SHALL ask for confirmation before pasting text that is multi-line, contains a dangerous command pattern, contains control characters or exceeds the size threshold, unless the user has disabled the warning.

#### Scenario: Multi-line paste
- **WHEN** the user pastes text with two or more lines
- **THEN** a dialog shows a preview with line count and requires explicit confirmation.

#### Scenario: Dangerous pattern
- **WHEN** the text matches a dangerous pattern (`sudo`, `rm -rf`, `dd if=`, `mkfs`, `chmod -R 777`, pipe-to-shell such as `curl … | sh`, fork bomb)
- **THEN** the dialog highlights the matching fragment as a warning.

#### Scenario: Hidden control characters
- **WHEN** the text contains ESC or other control characters, or zero-width characters
- **THEN** the preview renders them visibly (e.g. `␛`, `␀`) and warns about possible paste-jacking.

#### Scenario: Confirm or cancel
- **WHEN** the user confirms
- **THEN** the text is pasted honouring bracketed-paste mode
- **AND WHEN** the user cancels THEN nothing is sent to the shell.

#### Scenario: Paste as a single line
- **WHEN** the user chooses "Paste as one line"
- **THEN** newlines are replaced by spaces before pasting.

#### Scenario: Simple paste is not interrupted
- **WHEN** the text is a single line with no dangerous pattern and no control characters
- **THEN** it is pasted immediately without a dialog.

#### Scenario: Warning disabled
- **WHEN** the setting `paste_warning` is off
- **THEN** pastes are never interrupted.

---

### Requirement: In-Memory Paste History
The application SHALL keep the last N pasted texts in memory only, selectable with `Ctrl+Alt+V`, and MUST NOT persist them.

#### Scenario: Re-paste an earlier entry
- **WHEN** the user opens the paste history and selects an entry
- **THEN** it goes through the same confirmation rules and is pasted.

#### Scenario: History is cleared on lock
- **WHEN** the vault is locked or the application exits
- **THEN** the paste history MUST be discarded.

#### Scenario: Secrets are not previewed
- **WHEN** an entry looks like a secret (private key header, long base64 token)
- **THEN** the list shows a masked preview.
