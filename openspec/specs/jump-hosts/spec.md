# jump-hosts Specification

## Purpose
Proporciona la capacidad de conectar de manera transparente a servidores SSH ubicados en redes internas o privadas a través de servidores de salto intermedios (Jump Hosts / Bastions) mediante canales direct-tcpip sobre SSH, soportando encadenamiento multi-salto, prevención algorítmica de ciclos e importación automática de directivas ProxyJump.

## Requirements

### Requirement: Jump Host Association in Inventory
The system SHALL allow associating any SSH host with an optional intermediate jump host (`jump_host_id`) from the local inventory.

#### Scenario: Configure a host with a jump host
- **WHEN** the user creates or edits a host and selects an existing server as its Jump Host
- **THEN** the system persists the relationship `jump_host_id` in SQLite
- **AND** displays a visual route badge (e.g., "via Bastion") in the host list and quick connect modal.

#### Scenario: Prevention of cyclic jump host loops
- **WHEN** the user attempts to configure a jump host chain that would create a circular reference (e.g., Host A -> Host B -> Host A)
- **THEN** the system MUST reject the configuration with a validation error
- **AND** prevent saving the cyclic state to the database.

---

### Requirement: Chained SSH Connection via Direct-TCPIP
The SSH engine SHALL establish a transparent multi-hop SSH connection by opening a `direct-tcpip` forwarded channel through the jump host and using it as the underlying transport stream for the target host's SSH handshake.

#### Scenario: Successful chained interactive SSH session
- **WHEN** the user opens an SSH connection to a host configured with a Jump Host
- **THEN** the backend connects and authenticates with the Jump Host using its configured credentials
- **AND** opens a `direct-tcpip` channel to the target host's IP and port
- **AND** negotiates the target host SSH handshake over that channel using the target host's credentials
- **AND** attaches the interactive PTY, SFTP subsystem, and telemetry monitors seamlessly to the terminal interface.

#### Scenario: Jump host authentication failure
- **WHEN** the intermediate Jump Host fails to authenticate or is unreachable
- **THEN** the system pauses connection establishment
- **AND** emits a clear error indicating that the failure occurred at the Jump Host stage, preventing misleading errors regarding the target host.

---

### Requirement: Automatic ProxyJump SSH Config Import
The SSH config parser SHALL detect and link `ProxyJump` directives when importing configurations from `~/.ssh/config`.

#### Scenario: Import hosts with ProxyJump directive
- **WHEN** the user imports a block from `~/.ssh/config` containing `ProxyJump bastion-host`
- **THEN** the parser maps `ProxyJump` to the corresponding host entity in the inventory
- **AND** sets `jump_host_id` automatically when both hosts are imported.
