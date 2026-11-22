# Delta Spec: Autocompletado de Comandos en la Terminal

## ADDED Requirements

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
