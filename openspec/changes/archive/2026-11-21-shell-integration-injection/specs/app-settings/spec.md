# Delta Spec: Ajuste de Integración de Shell

## ADDED Requirements

### Requirement: Shell Integration Setting
The settings SHALL expose and persist the boolean preference `shell_integration` (default on), with a backward-compatible default for existing databases.

#### Scenario: Legacy settings load with the default
- **WHEN** the stored settings JSON lacks `shell_integration`
- **THEN** it is treated as enabled without error.

#### Scenario: Disabled preference
- **WHEN** the user turns the setting off and opens a new local terminal
- **THEN** the shell starts without the integration.

#### Scenario: Applies to new terminals
- **WHEN** the user changes the setting
- **THEN** already open terminals are not restarted
- **AND** the new value is used the next time a local terminal is opened.
