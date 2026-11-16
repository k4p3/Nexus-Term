# Delta Spec: Bloques de Comandos Navegables

## ADDED Requirements

### Requirement: Marker-Based Command Blocks
The terminal SHALL track each command detected through OSC 133 using xterm markers so that block boundaries remain correct when scrollback lines are trimmed.

#### Scenario: Block survives scrollback trimming
- **WHEN** older lines are discarded from the scrollback
- **THEN** remaining blocks still resolve to the correct lines
- **AND** blocks whose lines were discarded are removed.

#### Scenario: Status indicator
- **WHEN** a command finishes
- **THEN** its block shows a success or failure marker in the margin and the execution duration.

---

### Requirement: Block Actions
The terminal SHALL let the user select a block and copy its command, copy its output, search within it and re-run its command.

#### Scenario: Copy output
- **WHEN** the user selects a block and chooses "Copy output"
- **THEN** only the text between the output start and the command end is copied.

#### Scenario: Re-run command
- **WHEN** the user presses `Ctrl+Shift+R` on the selected or most recent block
- **THEN** the command text is inserted into the prompt and executed after the user confirms the safety preview if it matches a dangerous pattern.

#### Scenario: Search within a block
- **WHEN** the user searches while a block is selected
- **THEN** only matches inside that block are highlighted and navigated.

#### Scenario: No shell integration
- **WHEN** the shell does not emit OSC 133
- **THEN** block actions are disabled and the terminal behaves as before.
