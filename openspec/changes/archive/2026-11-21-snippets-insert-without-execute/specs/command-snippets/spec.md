## ADDED Requirements

### Requirement: Snippet Insertion Without Execution
Selecting a snippet from the snippet drawer or the command palette SHALL insert its text at the active terminal's prompt and SHALL NOT execute it. Execution SHALL happen only when the user presses `Enter`.

#### Scenario: Insert a plain snippet
- **WHEN** the user selects an enabled snippet without parameters
- **THEN** its text appears at the prompt of the active terminal
- **AND** no newline is sent, so the command is not executed.

#### Scenario: Insert a snippet with parameters
- **WHEN** the user fills in the parameters of a snippet and confirms
- **THEN** the resulting command is inserted at the prompt without being executed.

#### Scenario: Safe paste checks apply
- **WHEN** the inserted text is multi-line or matches the risky-paste patterns and the paste warning is enabled
- **THEN** the paste confirmation is shown before anything is inserted.

#### Scenario: Multi-line snippets are not run line by line
- **WHEN** a multi-line snippet is inserted
- **THEN** it is sent as a bracketed paste so the shell does not execute each line.

#### Scenario: No active terminal
- **WHEN** there is no active terminal pane
- **THEN** nothing is inserted and the user is informed.
