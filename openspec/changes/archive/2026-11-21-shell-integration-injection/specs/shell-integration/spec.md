# Delta Spec: Inyección de la Integración de Shell

## ADDED Requirements

### Requirement: Shell Integration Injection
When a local terminal is opened with bash, zsh or fish and the `shell_integration` setting is enabled, the application SHALL start the shell with an integration that emits the OSC 133 marks (`A` prompt start, `B` command start, `C` output start, `D;<exit code>` command end), and SHALL NOT modify any of the user's shell configuration files.

#### Scenario: zsh emits the marks
- **WHEN** a local zsh terminal is opened and the user runs a command
- **THEN** the terminal receives `A`, `B`, `C` and `D;<exit code>` in that order for that command.

#### Scenario: bash and fish emit the marks
- **WHEN** a local bash or fish terminal is opened and the user runs a command
- **THEN** the same sequence of marks is received.

#### Scenario: User configuration still loads
- **WHEN** the integration starts a shell
- **THEN** the user's own startup files are loaded as without the integration
- **AND** the files on disk are unchanged.

#### Scenario: Marks already present
- **WHEN** the shell already emits OSC 133 by itself (for example fish 4 or the user's own hooks)
- **THEN** the integration does not add a second set of marks.

#### Scenario: Unsupported shells
- **WHEN** the local shell is neither bash, zsh nor fish (for example PowerShell on Windows)
- **THEN** it starts exactly as before, without integration or errors.

#### Scenario: Integration cannot be prepared
- **WHEN** the integration files cannot be written
- **THEN** the shell still starts without integration
- **AND** the failure is not shown as a terminal error.

#### Scenario: Remote sessions are not touched
- **WHEN** an SSH session is opened
- **THEN** no integration is injected.

### Requirement: History With The Vault Locked
Commands that finish while the vault is locked SHALL be kept only in memory, up to a fixed limit, and SHALL be saved to the encrypted history when the vault is unlocked.

#### Scenario: Command run while locked
- **WHEN** a command finishes in a local terminal while the vault is locked
- **THEN** it is kept in memory with its exit code
- **AND** it is not written to disk, `localStorage` or logs.

#### Scenario: Flushed on unlock
- **WHEN** the vault is unlocked
- **THEN** the pending commands are saved to the host's encrypted history in their original order
- **AND** the in-memory queue is emptied.

#### Scenario: Offered while pending
- **WHEN** the user opens the history picker or the autocomplete popup with the vault locked
- **THEN** the pending commands of that host are offered.

#### Scenario: Privacy rules still apply
- **WHEN** a command starts with a space, is empty, is too long or matches the secret patterns
- **THEN** it is not queued.

#### Scenario: Memory is bounded
- **WHEN** more commands than the limit finish while locked
- **THEN** the oldest pending commands are discarded.

#### Scenario: Discarded on exit
- **WHEN** the application closes before the vault is unlocked
- **THEN** the pending commands are lost and nothing is persisted.

#### Scenario: History disabled
- **WHEN** command history is disabled in settings
- **THEN** nothing is queued.
