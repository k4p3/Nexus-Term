# Delta Spec: Historial de Comandos por Host

## ADDED Requirements

### Requirement: Encrypted Per-Host Command History
The system SHALL record commands detected through OSC 133 per host, store them encrypted with the vault key and MUST NOT write them in plain text to SQLite, logs or browser storage.

#### Scenario: Record a command
- **WHEN** a command finishes in a session of host H
- **THEN** its text is stored encrypted for H with timestamp, use count and last exit code
- **AND** repeated identical commands update the existing entry instead of duplicating it.

#### Scenario: Excluded commands
- **WHEN** a command starts with a space or matches a secret pattern (`password=`, `--password`, `token`, `export …KEY=`)
- **THEN** it MUST NOT be recorded.

#### Scenario: Recording disabled
- **WHEN** `history_enabled` is off
- **THEN** nothing is recorded.

#### Scenario: Vault locked
- **WHEN** the vault is locked
- **THEN** history cannot be read or written.

---

### Requirement: History Picker
The terminal SHALL provide a fuzzy picker, opened with `Ctrl+Shift+H`, over the history of the active host and the enabled snippets.

#### Scenario: Insert without executing
- **WHEN** the user presses `Enter` on an entry
- **THEN** the text is inserted into the prompt without a trailing newline.

#### Scenario: Insert and execute
- **WHEN** the user presses `Ctrl+Enter`
- **THEN** the text is inserted and executed, subject to the paste safety rules for dangerous patterns.

#### Scenario: Ranking
- **WHEN** the user types a query
- **THEN** entries are ranked by fuzzy score, then by use count and recency.

---

### Requirement: History Management
The user SHALL be able to delete a single entry, clear a host's history or clear everything.

#### Scenario: Clear host history
- **WHEN** the user clears the history of host H
- **THEN** all entries of H are permanently removed.

#### Scenario: Host deleted
- **WHEN** host H is deleted from the inventory
- **THEN** its history entries are deleted with it.
