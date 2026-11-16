# Delta Spec: Instant Replay

## ADDED Requirements

### Requirement: In-Memory Output Replay
The terminal SHALL keep a bounded circular buffer of recent timestamped output per pane, in memory only, and allow reviewing it in a read-only timeline viewer opened with `Ctrl+Shift+Y`.

#### Scenario: Review output after clear
- **WHEN** the user runs `clear` and then opens Instant Replay
- **THEN** the viewer can show the screen as it was before the clear by moving the timeline.

#### Scenario: Bounded memory
- **WHEN** the buffer exceeds 5 minutes or 8 MiB for a pane
- **THEN** the oldest chunks are discarded first.

#### Scenario: Read-only
- **WHEN** the viewer is open
- **THEN** no input is sent to the session and the live terminal keeps running.

#### Scenario: Never persisted
- **WHEN** the application exits or the vault is locked or the pane closes
- **THEN** the buffer is discarded
- **AND** it MUST NOT be written to disk.

#### Scenario: Disabled by setting
- **WHEN** `instant_replay` is off
- **THEN** no output is retained.
