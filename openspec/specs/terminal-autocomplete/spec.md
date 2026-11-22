# terminal-autocomplete Specification

## Purpose
TBD - created by archiving change autocomplete-popup. Update Purpose after archive.

## Requirements

### Requirement: Autocomplete Popup
The terminal SHALL provide an autocomplete popup, opened with `Ctrl+Space` and anchored at the cursor, that lists matching commands from the host's command history and from the enabled snippets, ranked by fuzzy score, usage count and recency.

#### Scenario: Open and filter while typing
- **WHEN** the user has typed `git ch` at the prompt and presses `Ctrl+Space`
- **THEN** the popup opens showing entries that fuzzy-match `git ch`
- **AND** keyboard focus stays in the terminal
- **AND** the list is refined as the user keeps typing.

#### Scenario: Accept a suggestion
- **WHEN** the popup is open, the user selects an entry with `↑`/`↓` and presses `Tab`
- **THEN** the text typed since the prompt is replaced by the selected command
- **AND** the command is NOT executed
- **AND** the popup closes.

#### Scenario: Enter is never intercepted
- **WHEN** the popup is open and the user presses `Enter`
- **THEN** the key is sent to the shell unchanged
- **AND** the popup closes.

#### Scenario: Dismiss
- **WHEN** the popup is open and the user presses `Esc`
- **THEN** the popup closes and the key is not sent to the shell.

#### Scenario: Snippets are suggested but not expanded blindly
- **WHEN** the user accepts a snippet that contains `{{parameters}}`
- **THEN** the snippet text is inserted as written without executing it.

### Requirement: Current Line Tracking
The terminal SHALL track the command line being typed in memory only, from the keystrokes sent to the shell, and SHALL mark the tracking as unreliable when a key makes it ambiguous.

#### Scenario: Printable keys and editing
- **WHEN** the user types characters, `Backspace` or `Ctrl+U`
- **THEN** the tracked line reflects the change.

#### Scenario: Line is reset on execution or interrupt
- **WHEN** the user presses `Enter` or `Ctrl+C`
- **THEN** the tracked line is cleared.

#### Scenario: Ambiguous keys
- **WHEN** the user presses an arrow key, `Tab`, `Ctrl+R`, pastes text or recalls shell history
- **THEN** the tracked line is marked unreliable
- **AND** the popup opened afterwards lists recent entries without filtering and inserts the chosen command without deleting any text.

#### Scenario: Tracked text is never persisted
- **WHEN** the popup is used
- **THEN** the tracked line is kept only in memory
- **AND** it is never written to the history, the settings, `localStorage` or any log.

### Requirement: Autocomplete Availability
The autocomplete popup SHALL NOT open while the terminal is on the alternate screen buffer, and SHALL respect the command history privacy rules.

#### Scenario: Alternate screen
- **WHEN** a full-screen program such as `vim` or `less` is running and the user presses `Ctrl+Space`
- **THEN** the popup does not open and the key is sent to the program.

#### Scenario: History disabled
- **WHEN** command history is disabled in settings
- **THEN** the popup lists only enabled snippets.

#### Scenario: Secrets are never suggested
- **WHEN** a history entry matches the secret patterns used to skip history recording
- **THEN** it is not offered in the popup
- **AND** user-authored snippets are not filtered, since they are written by the user.

#### Scenario: Lazy loading
- **WHEN** the application starts
- **THEN** the popup component is not part of the initial bundle and loads on first use.

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
