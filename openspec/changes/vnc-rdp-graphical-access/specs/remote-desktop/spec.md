# Delta Spec: Acceso Gráfico Remoto VNC y RDP

## ADDED Requirements

### Requirement: Graphical Protocol Hosts
The system SHALL allow hosts to declare a protocol of `ssh`, `rdp` or `vnc`, and MUST open a remote desktop session tab for `rdp` and `vnc` hosts.

#### Scenario: Open an RDP session
- **WHEN** the user connects to a host with protocol `rdp`
- **THEN** the system opens a graphical session tab rendering the remote desktop
- **AND** authenticates with the credentials of the linked vault identity.

#### Scenario: Open a VNC session
- **WHEN** the user connects to a host with protocol `vnc`
- **THEN** the system performs the RFB handshake and renders the remote framebuffer in a new tab.

#### Scenario: Authentication failure
- **WHEN** the remote server rejects the credentials
- **THEN** the system MUST close the session, show an explicit authentication error
- **AND** MUST NOT log or expose the password.

#### Scenario: Server unreachable
- **WHEN** the TCP connection times out or is refused
- **THEN** the system shows a connection error with the target host and port and allows retrying.

---

### Requirement: Binary Frame Streaming
The backend SHALL stream framebuffer updates to the frontend as binary dirty rectangles through a `tauri::ipc::Channel`, and MUST NOT send pixel data as JSON events.

#### Scenario: Partial screen update
- **WHEN** the remote screen changes in a sub-region
- **THEN** only the changed rectangle (x, y, width, height, RGBA bytes) is sent and composed onto the canvas.

#### Scenario: Slow consumer
- **WHEN** the frontend cannot keep up with incoming updates
- **THEN** the backend MUST coalesce pending rectangles instead of growing memory without bound.

---

### Requirement: Remote Input
The system SHALL forward keyboard, mouse (move, buttons, wheel) and Ctrl+Alt+Del input to the remote session with low latency.

#### Scenario: Typing and clicking
- **WHEN** the session canvas has focus and the user types or clicks
- **THEN** the corresponding key/pointer events are delivered to the remote host.

#### Scenario: Ctrl+Alt+Del
- **WHEN** the user presses the toolbar "Ctrl+Alt+Supr" button
- **THEN** the system sends the secure attention sequence to the remote host without triggering the local OS shortcut.

---

### Requirement: Dynamic Resolution and Scaling
The system SHALL adapt the remote resolution to the pane size for RDP (Display Control) and SHALL offer client-side scaling ("fit" / 100%) for VNC.

#### Scenario: Resize the pane
- **WHEN** the user resizes the window or pane of an RDP session
- **THEN** the system requests a new desktop size after a debounce and redraws without reconnecting.

---

### Requirement: Text Clipboard Sync
The system SHALL synchronize plain-text clipboard content bidirectionally between local and remote sessions when enabled in settings.

#### Scenario: Copy remote to local
- **WHEN** the user copies text in the remote desktop
- **THEN** the local clipboard receives that text.

#### Scenario: Clipboard disabled
- **WHEN** clipboard sync is disabled in settings
- **THEN** the system MUST NOT send or accept clipboard data.

---

### Requirement: Secure Transport and Credentials
The system SHALL encrypt RDP over TLS (NLA/CredSSP), SHALL allow tunnelling RDP/VNC through an SSH jump host via `direct-tcpip`, and MUST keep all credentials encrypted in the vault.

#### Scenario: VNC through SSH tunnel
- **WHEN** a VNC host has a `jump_host_id`
- **THEN** the backend opens a `direct-tcpip` channel through the jump host and runs RFB over it
- **AND** the VNC server does not need to be reachable from the client network.

#### Scenario: Unknown or changed RDP certificate
- **WHEN** the server certificate fingerprint is new or differs from the stored one
- **THEN** the system MUST ask the user to accept it before sending credentials
- **AND** stores the accepted fingerprint in the vault.

#### Scenario: Locked vault
- **WHEN** the vault is locked
- **THEN** the system MUST refuse to start a graphical session.

---

### Requirement: Session Lifecycle
The system SHALL release network resources and zeroize credential buffers when a graphical session closes, and SHALL notify the frontend of remote disconnections.

#### Scenario: Remote side disconnects
- **WHEN** the remote server closes the session
- **THEN** the tab shows a "Disconnected" overlay with a "Reconnect" action.

#### Scenario: User closes the tab
- **WHEN** the user closes the graphical tab
- **THEN** the backend terminates the session task and frees its channels.
