## ADDED Requirements

### Requirement: Contextual Suggestion Keys
The keys that accept an inline suggestion (`→`, `End`, `Ctrl+→`) SHALL be consumed only while a suggestion is visible; otherwise they SHALL reach the shell unchanged. They are documented in the shortcut sheet and manuals but are not entries of the global shortcut registry.

#### Scenario: No suggestion visible
- **WHEN** no suggestion is visible and the user presses `→`, `End` or `Ctrl+→`
- **THEN** the key is sent to the shell unchanged.
