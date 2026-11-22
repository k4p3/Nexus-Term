## ADDED Requirements

### Requirement: Inline Suggestion Setting
The application SHALL provide a boolean setting `inline_suggestion`, enabled by default, that controls the inline command suggestion in the terminal. Settings saved before the field existed SHALL load with it enabled.

#### Scenario: Default and legacy settings
- **WHEN** settings are loaded from a store saved without `inline_suggestion`
- **THEN** `inline_suggestion` is `true`.

#### Scenario: Toggle
- **WHEN** the user turns the option off in *Settings → Terminal*
- **THEN** suggestions stop appearing in all terminals without restarting them.
