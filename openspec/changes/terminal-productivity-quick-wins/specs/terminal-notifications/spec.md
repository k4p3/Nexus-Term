# Delta Spec: Notificación de Comandos Largos

## ADDED Requirements

### Requirement: Long Command Completion Notice
The application SHALL notify the user when a command detected through OSC 133 finishes after running longer than the configured threshold and the originating pane is not in view.

#### Scenario: Notify when the window is unfocused
- **WHEN** a command runs for at least `notify_threshold_seconds` and the window is not focused
- **THEN** a desktop notification reports success or failure, the duration and the host label.

#### Scenario: Notify when another tab is active
- **WHEN** the window is focused but the originating pane belongs to a hidden tab
- **THEN** an in-app toast is shown instead of a desktop notification.

#### Scenario: No notification when visible
- **WHEN** the originating pane is visible and the window is focused
- **THEN** no notification is shown.

#### Scenario: Short commands are ignored
- **WHEN** a command finishes before the threshold
- **THEN** no notification is shown.

#### Scenario: Privacy of command text
- **WHEN** a notification is built
- **THEN** it MUST NOT include the command text unless `notify_include_command` is enabled.

#### Scenario: Click focuses the pane
- **WHEN** the user activates the notification
- **THEN** the window is brought to front and the originating tab and pane are activated.

#### Scenario: Notifications unavailable
- **WHEN** the system denies permission or has no notification service
- **THEN** the application falls back to the in-app toast and does not raise an error.

#### Scenario: Disabled by setting
- **WHEN** `notify_long_commands` is off
- **THEN** no notification of any kind is produced.
