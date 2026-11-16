# Delta Spec: Restauración de Sesiones

## ADDED Requirements

### Requirement: Layout Persistence
The system SHALL persist the layout of tabs and split panes (structure, ratios and host identifiers) and MUST NOT persist credentials, terminal contents or commands in it.

#### Scenario: Save on change
- **WHEN** tabs or panes are opened, closed, split or resized
- **THEN** the layout is saved after a short debounce.

#### Scenario: Only references to hosts
- **WHEN** the layout is serialised
- **THEN** it contains host IDs and titles, never hostnames' secrets or identity data.

---

### Requirement: Restore on Startup
After the vault is unlocked the application SHALL offer to restore the previous layout, or restore it automatically when `restore_sessions` is `auto`.

#### Scenario: Prompt to restore
- **WHEN** the vault is unlocked and a saved layout with at least one tab exists and the mode is `ask`
- **THEN** a dialog offers "Restore (N tabs)" or "Start empty".

#### Scenario: Deferred connection
- **WHEN** a layout is restored
- **THEN** each tab connects only when it first becomes active.

#### Scenario: Missing host
- **WHEN** a restored pane references a host that no longer exists
- **THEN** that pane is skipped and the user is informed.

#### Scenario: Local shells
- **WHEN** a restored pane was a local shell
- **THEN** a new local shell is opened without restoring its directory or contents.

#### Scenario: Graphical hosts
- **WHEN** a restored pane references an RDP or VNC host
- **THEN** it is restored as a remote desktop pane that connects on activation.

#### Scenario: Disabled
- **WHEN** `restore_sessions` is `off`
- **THEN** no layout is saved or offered.
