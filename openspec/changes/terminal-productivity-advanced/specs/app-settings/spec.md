# Delta Spec: Preferencias Avanzadas de la Terminal

## ADDED Requirements

### Requirement: Advanced Terminal Preferences
The settings SHALL expose and persist `history_enabled` (default on), `instant_replay` (default on), `restore_sessions` (`ask` | `auto` | `off`, default `ask`), `osc52_clipboard` (default on), `inline_images` (default on) and `font_ligatures` (default off), with backward-compatible defaults.

#### Scenario: Legacy settings load with defaults
- **WHEN** the stored settings JSON lacks the new keys
- **THEN** the defaults are applied without error.

#### Scenario: Invalid restore mode
- **WHEN** `restore_sessions` holds an unknown value
- **THEN** it is replaced by `ask`.
