# Delta Spec: Terminal Local Inicial

## ADDED Requirements

### Requirement: Initial Local Terminal
The application SHALL ensure that, once startup is resolved, at least one tab is open; when no tab exists and none was restored, it MUST open a local terminal tab.

#### Scenario: Startup without password prompt
- **WHEN** the application starts with the vault locked and "ask password on startup" disabled and there is no saved layout
- **THEN** a local terminal tab is opened.

#### Scenario: Startup with password prompt
- **WHEN** the user unlocks the vault at startup with "ask password on startup" enabled and there is no saved layout
- **THEN** a local terminal tab is opened.

#### Scenario: Restored tabs are not duplicated
- **WHEN** a saved layout with tabs is restored at startup
- **THEN** no additional local terminal tab is added.

#### Scenario: Restore discarded
- **WHEN** the user discards the restore offer
- **THEN** a local terminal tab is opened.

#### Scenario: Locking later does not reopen tabs
- **WHEN** the user locks and unlocks the vault after startup was resolved
- **THEN** no additional local terminal tab is opened.
