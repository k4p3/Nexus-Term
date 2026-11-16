# Delta Spec: Addons de Compatibilidad del Terminal

## ADDED Requirements

### Requirement: Unicode 11 Widths
The terminal SHALL use Unicode 11 character widths so that emoji and wide characters align correctly.

#### Scenario: Wide characters
- **WHEN** the output contains emoji or CJK characters
- **THEN** cursor positioning and line wrapping account for their double width.

---

### Requirement: OSC 52 Clipboard
The terminal SHALL honour OSC 52 write requests to set the local clipboard when enabled, and MUST NOT allow remote programs to read the local clipboard.

#### Scenario: Remote copy
- **WHEN** a remote program such as `tmux` or `vim` emits an OSC 52 write
- **THEN** the text up to 1 MiB is copied to the local clipboard and a brief notice is shown.

#### Scenario: Read requests are refused
- **WHEN** a remote program emits an OSC 52 read query
- **THEN** it is ignored and no clipboard data is returned.

#### Scenario: Disabled
- **WHEN** `osc52_clipboard` is off
- **THEN** OSC 52 sequences are ignored.

---

### Requirement: Inline Images
The terminal SHALL render sixel and iTerm2 inline images when enabled, within a memory limit.

#### Scenario: Display an image
- **WHEN** a program emits a sixel image
- **THEN** it is drawn at the cursor position.

#### Scenario: Memory limit
- **WHEN** images exceed the configured cache limit
- **THEN** the oldest are evicted and the application does not grow without bound.

---

### Requirement: Font Ligatures
The terminal SHALL support font ligatures as an optional, default-off setting.

#### Scenario: Enable ligatures
- **WHEN** the user enables ligatures and the font defines them
- **THEN** sequences such as `=>` and `!=` render as ligatures.
