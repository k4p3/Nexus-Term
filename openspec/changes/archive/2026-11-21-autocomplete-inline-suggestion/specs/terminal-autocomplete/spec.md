## ADDED Requirements

### Requirement: Inline Suggestion
The terminal SHALL display, after the cursor and in a muted color, the best prefix match from the host's command history and the enabled snippets for the command being typed, and SHALL read the typed text from the screen using the OSC 133 prompt marks. The suggestion SHALL never be executed or sent to the shell until the user accepts it.

#### Scenario: Suggestion appears while typing
- **WHEN** the shell reports the prompt input position (OSC 133 `B`) and the user has typed `git ch` and the history contains `git checkout main`
- **THEN** `eckout main` is shown in muted color right after the cursor
- **AND** nothing is sent to the shell.

#### Scenario: Accept the whole suggestion
- **WHEN** a suggestion is visible, the cursor is at the end of the typed text and the user presses `→` or `End`
- **THEN** the remaining text is inserted at the prompt without executing it
- **AND** the suggestion disappears.

#### Scenario: Accept one word
- **WHEN** a suggestion is visible and the user presses `Ctrl+→`
- **THEN** only the next word of the suggestion is inserted.

#### Scenario: Other keys are untouched
- **WHEN** a suggestion is visible and the user presses any other key, including `Enter` and `Tab`
- **THEN** the key reaches the shell unchanged
- **AND** the suggestion is recalculated from the new line.

#### Scenario: Cursor not at the end
- **WHEN** the cursor is not at the end of the typed text
- **THEN** no suggestion is shown and `→`/`End` behave as the shell defines.

#### Scenario: Hidden when it could mislead
- **WHEN** the terminal is on the alternate screen buffer, the autocomplete popup is open, a selection is active, the typed text spans several lines, or the shell emits no OSC 133 marks
- **THEN** no suggestion is shown.

#### Scenario: Privacy
- **WHEN** a history entry was excluded from recording or flagged as secret
- **THEN** it is never suggested
- **AND** the suggestion is kept only in memory.

#### Scenario: Disabled by setting
- **WHEN** `inline_suggestion` is disabled
- **THEN** no suggestion is shown and `→`/`End` always reach the shell.
