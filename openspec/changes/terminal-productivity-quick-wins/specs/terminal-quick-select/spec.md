# Delta Spec: Quick Select (Hints)

## ADDED Requirements

### Requirement: Keyboard Selection of On-Screen Tokens
The terminal SHALL provide a Quick Select mode, activated with `Ctrl+Shift+Space`, that highlights recognised tokens in the visible viewport and assigns each a keyboard label.

#### Scenario: Highlight recognised tokens
- **WHEN** the user activates Quick Select
- **THEN** URLs, file paths, git hashes (7–40 hex), IPv4/IPv6 addresses, UUIDs and e-mail addresses in the viewport are highlighted
- **AND** each distinct value receives a label from the home-row alphabet, using multi-character labels when there are more matches than letters.

#### Scenario: Copy a match
- **WHEN** the user types a label in lowercase
- **THEN** the matched text is copied to the clipboard and the mode closes.

#### Scenario: Paste a match into the prompt
- **WHEN** the user types a label with `Shift` (uppercase)
- **THEN** the matched text is pasted into the active prompt without executing it.

#### Scenario: Cancel
- **WHEN** the user presses `Escape` or no match exists
- **THEN** the mode closes without changing the clipboard or sending input to the shell.

#### Scenario: Keystrokes are not leaked to the shell
- **WHEN** Quick Select is active
- **THEN** no typed key is forwarded to the PTY or SSH session.
