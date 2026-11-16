# Delta Spec: Enlaces Inteligentes en la Terminal

## ADDED Requirements

### Requirement: File Path Links
The terminal SHALL detect `path`, `path:line` and `path:line:column` tokens and make them activatable with `Ctrl+Click` (`Cmd+Click` on macOS).

#### Scenario: Detect a path with line
- **WHEN** the output contains `src/main.rs:10:5`
- **THEN** the token is underlined on hover while `Ctrl` is held.

#### Scenario: Context actions on a path in an SSH session
- **WHEN** the user activates a path link in an SSH session
- **THEN** a menu offers "Copy path" and "Show in SFTP"
- **AND** "Show in SFTP" opens the SFTP sidebar at the containing directory of that host.

#### Scenario: Context actions on a path in a local session
- **WHEN** the user activates a path link in a local session
- **THEN** a menu offers "Copy path" only.

---

### Requirement: IP Address Links
The terminal SHALL detect IPv4 and IPv6 addresses and offer actions on them.

#### Scenario: Connect to a detected IP
- **WHEN** the user activates an IP link and chooses "Connect via SSH"
- **THEN** the quick-connect dialog opens prefilled with that address.

#### Scenario: Invalid addresses are ignored
- **WHEN** the output contains `999.1.1.1` or a version string such as `1.2.3.4.5`
- **THEN** it MUST NOT be linked.

---

### Requirement: No Accidental Activation
Links MUST only activate with the modifier key held so that selecting text with the mouse is never interrupted.

#### Scenario: Plain click selects text
- **WHEN** the user clicks on a link without the modifier
- **THEN** no menu or navigation occurs.
