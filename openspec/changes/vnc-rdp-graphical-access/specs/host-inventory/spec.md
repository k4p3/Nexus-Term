# Delta Spec: Host Inventory — Protocolo

## ADDED Requirements

### Requirement: Host Protocol Field
The inventory SHALL store a `protocol` (`ssh`, `rdp`, `vnc`) per host, defaulting to `ssh`, and MUST apply the default port of the protocol (22, 3389, 5900) when the user does not set one.

#### Scenario: Migrate existing hosts
- **WHEN** the vault is opened after upgrading
- **THEN** all existing hosts have protocol `ssh` and remain unchanged.

#### Scenario: Create an RDP host
- **WHEN** the user selects protocol `rdp` in the host modal
- **THEN** the port defaults to 3389 and the host shows an RDP badge in the tree and in Ctrl+K.

#### Scenario: Invalid protocol
- **WHEN** a payload contains an unknown protocol value
- **THEN** the system MUST reject it with a validation error.
