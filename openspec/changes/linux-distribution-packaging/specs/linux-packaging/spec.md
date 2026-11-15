# Delta Spec: Linux Distribution Packaging (AUR, Flatpak and Snap)

## ADDED Requirements

### Requirement: AUR Native Package Recipe
The project SHALL provide an Arch User Repository (`PKGBUILD`) recipe for `nexus-term-bin` to allow seamless installation and automated updates on Manjaro, Arch Linux, and derivative distributions.

#### Scenario: Building and installing AUR binary package
- **WHEN** the user executes `makepkg -si` inside `packaging/aur/` on Manjaro or Arch Linux
- **THEN** the script downloads the verified release binary tarball or package matching the specified version and SHA256 checksum
- **AND** installs the executable to `/usr/bin/nexus-term`
- **AND** installs the desktop launcher to `/usr/share/applications/dev.nexusterm.app.desktop`
- **AND** installs the official icons across standard hicolor resolutions (`32x32`, `128x128`, `256x256`, `512x512`)
- **AND** registers the GPL-3.0 license in `/usr/share/licenses/nexus-term/LICENSE`.

#### Scenario: Automated AUR metadata synchronization
- **WHEN** the script `scripts/update-aur.sh` is executed with a new release tag (e.g., `v0.1.0-beta`)
- **THEN** it fetches the release artifacts, calculates the SHA256 checksums
- **AND** updates `pkgver`, `pkgrel`, and `sha256sums` in `packaging/aur/PKGBUILD`
- **AND** regenerates `packaging/aur/.SRCINFO`.

---

### Requirement: Universal Flatpak Sandbox Specification
The project SHALL provide a Flatpak manifest (`dev.nexusterm.app.yml`) and AppStream metainfo specification compliant with Flathub distribution standards.

#### Scenario: Flatpak sandbox permissions and hardware access
- **WHEN** NexusTerm runs inside the Flatpak sandbox
- **THEN** it MUST be granted `--share=network` for SSH multiplexing, SFTP transfers, and live telemetry
- **AND** `--socket=wayland` and `--socket=fallback-x11` for window rendering
- **AND** `--socket=ssh-auth` to interact with the host system's SSH authentication agent
- **AND** `--talk-name=org.freedesktop.StatusNotifierWatcher` to allow the system tray icon to integrate with KDE Plasma and GNOME panel indicators.

#### Scenario: AppStream metainfo validation
- **WHEN** the metainfo file `dev.nexusterm.app.metainfo.xml` is validated with `appstreamcli validate`
- **THEN** it SHALL pass with zero fatal errors, providing application ID, developer name, project URLs, license, release history, and feature summaries in Spanish and English.

---

### Requirement: Canonical Snapcraft Manifest
The project SHALL provide a `snapcraft.yaml` specification for building and publishing NexusTerm to the Canonical Snap Store.

#### Scenario: Building snap package
- **WHEN** `snapcraft` builds the package
- **THEN** it bundles the required WebKitGTK runtime dependencies
- **AND** connects the plugs `network`, `network-bind`, `desktop`, `desktop-legacy`, `wayland`, `x11`, `unity7`, and `ssh-keys`.
