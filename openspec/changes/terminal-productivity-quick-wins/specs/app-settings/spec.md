# Delta Spec: Preferencias de Productividad de la Terminal

## ADDED Requirements

### Requirement: Productivity Preferences
The settings SHALL expose and persist the preferences `paste_warning` (default on), `paste_history_size` (default 20), `notify_long_commands` (default on), `notify_threshold_seconds` (default 10) and `notify_include_command` (default off), with backward-compatible defaults for existing databases.

#### Scenario: Legacy settings load with defaults
- **WHEN** the stored settings JSON lacks the new keys
- **THEN** the defaults above are applied without error.

#### Scenario: Out-of-range values are clamped
- **WHEN** `notify_threshold_seconds` is below 1 or above 3600, or `paste_history_size` is above 100
- **THEN** the value is clamped to the valid range when saved.

#### Scenario: Changes apply immediately
- **WHEN** the user changes a productivity preference
- **THEN** open panes use the new value without reconnecting.
