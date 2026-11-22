# Changelog

All notable changes to **NexusTerm** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.4.0] - 2026-11-21

### Added
- **Import and export snippets**: new buttons in the snippet drawer. Import a `nexusterm-snippets` JSON file after reviewing a summary with every command in full (risky patterns such as `sudo`, `rm -rf` or `curl | sh` are flagged); duplicates are skipped and nothing is overwritten. Imported snippets are tagged and show an *imported* badge. Files with line breaks, control, bidirectional or invisible characters are rejected per entry (limits: 1 MB, 500 snippets). Export saves your custom snippets in the same format.
- **Inline command suggestion**: while you type, the likely continuation of the command appears in gray after the cursor, taken from the host's history (and plain snippets). `→` or `End` accept it, `Ctrl+→` accepts one word; every other key, including `Enter` and `Tab`, reaches the shell untouched. It reads the typed text from the OSC 133 marks, so it works with local terminals (and remote shells with their own integration) and hides itself on full-screen programs, with the popup open or with a selection. Turn it off with *Settings → Terminal → Inline suggestion*.
- **More built-in Docker snippets**: Compose up/down/logs/status, images, resource usage, restart and container processes (the community catalog now has 23 snippets).
- **Command autocomplete popup**: `Ctrl+Space` opens suggestions anchored at the cursor from the host's encrypted history and enabled snippets. It filters as you type, `Tab` inserts without running, `Esc` closes, and `Enter` is never intercepted. It stays off on full-screen programs. Note that `Ctrl+Space` (readline *set-mark*) no longer reaches the shell.
- **New local terminal shortcut**: `Ctrl+Shift+T` (`Cmd+Shift+T` on macOS) opens a local terminal in a new tab from anywhere.
- **Switch tabs from the keyboard**: `Ctrl+Tab` / `Ctrl+Shift+Tab` (or `Ctrl+PageDown` / `Ctrl+PageUp`) move to the next / previous tab, wrapping around at both ends.
- **Jump to a tab**: `Alt+1` … `Alt+8` select that tab and `Alt+9` selects the last one. Note that these keys no longer reach the shell (for example `readline` numeric arguments or `tmux` windows).

### Changed
- **Snippets are inserted, not executed**: choosing a snippet (drawer or `Ctrl+K`) now types it at the prompt of the active terminal without a trailing newline, so you review it and press `Enter`. It goes through the safe-paste checks and bracketed paste. Before, it ran immediately. If no terminal is open you get a notice.
- **Snippet parameters ignore Go templates**: `{{.ID}}`-style placeholders (as in `docker ps --format`) are no longer asked for as parameters; only `{{name}}` / `{{name=default}}` are. This fixes the built-in *Docker: List with Ports* snippet.
- **Automatic shell integration in local terminals**: NexusTerm now injects OSC 133 marks into local bash, zsh and fish (< 4) sessions without editing your config files, so command blocks, history and autocomplete work out of the box. Turn it off with *Settings → Terminal → Shell integration* if you already have your own. Applies to new terminals; SSH sessions are unchanged.
- **History is no longer lost while the vault is locked**: commands finished before unlocking are kept in memory (up to 200, never written unencrypted) and saved encrypted on unlock.
- **A local terminal always opens at startup** when there is nothing to restore, also when *Ask for the master password at startup* is enabled (before, the workspace could stay empty after unlocking). Restored tabs are never duplicated with an extra local terminal.

### Fixed
- **Command block duration indicator** (✓/✗ and time) is anchored to the right edge of the prompt line instead of overlapping the command on the left.

---

## [0.3.0] - 2026-11-21

A visual redesign with a real theme system: light and dark themes, follow-the-system mode, and a fully translated interface.

### Added
- **Theme system**: every UI color now comes from design tokens, so a theme changes the whole window, not only the terminal. Three new themes ship with the app: **Nexus Slate** (new default, dark), **Nexus Paper** and **Solarized Light** (light), next to the six existing ones. All built-in themes meet a 4.5:1 text contrast.
- **Appearance settings** (*Settings → Terminal Appearance*): *Follow system* mode with a chosen light and dark theme, interface density (comfortable or compact), and the option to remove imported themes.
- **Persisted custom themes**: imported themes are now saved and restored on restart (before, they were lost). Older settings files keep loading.
- **Inter and JetBrains Mono fonts**, bundled with the app (OFL-1.1).
- **Shared dialog components** (`BaseModal`, `BaseButton`, `IconButton`, `EmptyState`): consistent dialogs with proper dialog semantics, focus handling and Escape that closes only the topmost dialog.
- **Show/hide password** button and labelled fields on the vault unlock screen.
- **Single source for the app version**: the version shown in the top bar and in *About* is read from `package.json`. `pnpm bump <x.y.z>` updates every versioned file (including the AUR package), and a test fails when they get out of sync or the CHANGELOG lacks the current release.

### Changed
- **Redesigned interface**: quieter top bar, tabs with an accent line and a connection dot for remote sessions, sidebar actions that appear on hover or keyboard focus, and badges and error messages that use soft tints instead of heavy fills.
- **Interface fully translated**: hard-coded Spanish texts in dialogs, tooltips, errors and confirmations now follow the selected language, including store and notification messages, the system tray menu and the built-in snippets. Backend error messages are now in English.
- **Built-in snippets** are stored in English (parameters renamed, e.g. `{{container}}`, `{{lines}}`) and shown translated in Spanish; existing installs are refreshed on startup and keep their enabled/disabled choice.
- The default theme is now **Nexus Slate** (existing installs keep the theme they had selected).

### Fixed
- The identity type badge (Password, Agent, key) no longer overflows its border: emojis were replaced with icons that fit.
- Several styles that referenced undefined classes (`bg-theme-input`, `bg-theme-panel`, `bg-theme-hover`, `ring-theme-accent`) never applied; they now use real tokens.
- The *About* screen showed an outdated version.

---

## [0.2.0] - 2026-11-20

On-demand vault unlock, auto-lock, keyboard navigation between split panes and more reliable SSH sessions.

### Added
- **Keyboard pane navigation**: `Alt+←` `Alt+→` `Alt+↑` `Alt+↓` move focus to the neighbouring split pane. The key is only intercepted when there is a pane in that direction; otherwise it reaches the shell. The active pane now also shows a tinted header and its title in the accent colour, and inactive panes draw a hollow cursor.
- **Lazy vault unlock**: the app no longer asks for the master password at launch. It opens a local terminal right away and asks for the password only when you use something that needs stored credentials (saved hosts, identities, SFTP, tunnels, remote desktop, importing `~/.ssh/config`). After unlocking, the action you started continues on its own. The old behaviour is available with the new setting *Ask for the master password at startup*.
- **Auto-lock on inactivity** (*Settings → Security*): enabled by default after 10 minutes, configurable from 1 to 1440 minutes or off. Inactivity is measured by your keyboard, mouse and focus, never by terminal output.
- **Locking keeps your sessions**: locking the vault (manually or automatically) no longer closes open terminals; it only blocks opening new connections that use credentials until you unlock again.
- **Previous-session offer as a banner**: after an on-demand unlock, restoring the previous session is offered in a non-blocking banner instead of a second dialog, and ignoring it never overwrites the saved layout.
- **Reconnect button** for SSH sessions that were closed by the server or the network.
- New settings: `ask_password_on_startup`, `auto_lock_enabled`, `auto_lock_minutes` (now 10 by default; the old value `0` is treated as unset). The backend locked-vault error now carries the stable code `VAULT_LOCKED:`.

### Fixed
- SSH sessions no longer freeze after a period of inactivity: a keepalive is sent every 30 s and a dead connection is detected after about 2 minutes. When a session closes unexpectedly, the terminal shows a notice and offers to reconnect.
- Terminal sizing: the terminal now refits when the font finishes loading and right after the session opens, and its container takes the theme background, so no mismatched strip is left below the last row.
- Privacy audit test updated for `tauri-plugin-single-instance` (local IPC only, no network access).

---

## [0.1.1] - 2026-11-17

### Fixed
- Local terminal: the shell no longer inherits AppImage environment variables (`LD_LIBRARY_PATH`, `APPDIR`, GTK/GIO paths...), which caused `symbol lookup error` in system programs such as `node` when running from the AppImage.

---

## [0.1.1] - 2026-11-16

First full production-ready release of **NexusTerm**, featuring embedded graphical remote desktops (VNC/RDP), advanced terminal productivity tools, concurrent SFTP transfers, SSH Jump Hosts, and deep memory/bundle performance optimizations.

### Added
- **Performance & Memory Optimization**:
  - Implemented lazy loading (`defineAsyncComponent`) across all secondary views, drawers, and modals (`SettingsModal`, `SnippetDrawer`, `PortForwardManager`, `SftpSidebar`, `TransferQueue`, `RemoteDesktopPane`, `ShortcutsModal`, `RestoreSessionsModal`, `TerminalCommandPalette`), significantly reducing initial JavaScriptCore heap and idle RAM footprint.
  - Configured optimized Rust release profile with Link-Time Optimization (`lto = true`), single codegen unit (`codegen-units = 1`), panic abort (`panic = "abort"`), and symbol stripping (`strip = true`), slashing the production executable size from ~200+ MB down to under 20 MB.
  - Configured Vite manual Rollup chunks for terminal libraries, Lucide icons, and core dependencies.
- **Project website** (GitHub Pages, English and Spanish): home page, step-by-step usage guide and shortcut cheat sheet, built as plain static HTML/CSS in `site/` with no third-party resources, published by `.github/workflows/pages.yml` and covered by an automated test (`src/utils/site.docs.test.ts`) that checks language parity, every registered shortcut, links and the absence of external resources.
- **Command blocks** based on xterm markers (OSC 133): ✓/✗ + duration in the margin, block selection, copy command/output, search within a block and re-run (`Ctrl+Shift+R`). Blocks stay correct when the scrollback is trimmed (the previous model used absolute line numbers).
- **Per-host command history** (`Ctrl+Shift+H`): stored encrypted with the vault key (AES-256-GCM), fuzzy picker with snippets, `Enter` inserts / `Ctrl+Enter` runs. Commands with a leading space or secret-looking text are never recorded; management from Settings.
- **Instant Replay** (`Ctrl+Shift+Y`): in-memory circular buffer (5 min / 8 MiB per pane) with a read-only timeline viewer; never written to disk and wiped on vault lock.
- **Session restore**: layout of tabs and panes saved (no credentials or contents) and restored after unlocking the vault (*Ask* / *Always* / *Never*), with lazy per-tab connection.
- **Terminal compatibility** via `@xterm/addon-unicode11`, `addon-clipboard` (OSC 52, write-only, 1 MiB), `addon-image` (sixel / iTerm2) and `addon-ligatures` + `addon-canvas` (optional font ligatures; a Settings notice checks that the font in use has them). All MIT-licensed.
- New settings: `history_enabled`, `instant_replay`, `restore_sessions`, `osc52_clipboard`, `inline_images`, `font_ligatures`; new tables `command_history` and `session_layout`.
- **Terminal Quick Select** (`Ctrl+Shift+Space`): keyboard hints for URLs, paths, git hashes, IPs, UUIDs and e-mails; lowercase copies, uppercase pastes.
- **Terminal Command Palette** (`Ctrl+Shift+P`): fuzzy search over terminal actions, themes and snippets, with shortcuts shown.
- **Safe Paste**: confirmation with preview for multi-line text, dangerous commands and hidden control characters; in-memory **Paste History** (`Ctrl+Alt+V`) wiped on vault lock.
- **Smart Links** for file paths (`path:line:col`) and IP addresses with `Ctrl`+click context menus (copy, show in SFTP, connect via SSH). The manual previously described this but only URLs were detected.
- **Long-Command Notifications**: desktop notification or in-app toast when a command finishes after a configurable threshold (`tauri-plugin-notification`, Apache-2.0 OR MIT). The command text is excluded by default.
- **Keyboard Shortcut Cheat Sheet** (`Ctrl+Shift+/`) and a single shortcut registry shared by the key handler, the palette and the documentation (a test fails if a shortcut is undocumented).
- **VNC & RDP graphical access**: remote desktop sessions (VNC complete; RDP video, keyboard, mouse and certificate TOFU) integrated as tabs and split panes.
- New settings: `paste_warning`, `paste_history_size`, `notify_long_commands`, `notify_threshold_seconds`, `notify_include_command`, `remote_desktop_clipboard`.
- `docs/ROADMAP.md` with planned work and tentative ideas.
- **SFTP Concurrent Transfers**: Multi-file background transfer queue with real-time progress bars, speed gauges, retry logic, and configurable concurrency pool.
- **SSH Jump Hosts & Bastion Chaining**: Transparent bastion chaining (`A -> B -> Target`) using native Rust `direct-tcpip` multiplexing without external proxy binaries.
- **Default Community Snippets**: Built-in curated catalog of 23 essential sysadmin/DevOps snippets (Docker, Systemd, Network, Storage & Kernel diagnostics).
- **Snippet State Management**: Toggle snippets enabled/disabled individually without deleting them from the database.
- **Origin Filtering & Cloning**: Filter snippets by "All", "Community", or "Custom" in the drawer, and 1-click duplicate built-in snippets to customize them.
- **Branding**: Official GitHub Social Preview card (1280x640) added to `public/social-preview.png`.
- **Comprehensive Documentation**: Complete coverage of SFTP, SSH Tunnels, Jump Hosts, VNC/RDP, Telemetry, and OS Desktop Integration across `README.md`, `README.es.md`, and `docs/FEATURES_MANUAL.md`.


---

## [0.1.0-beta] - 2026-11-15

Initial public Beta release of **NexusTerm**, a modern, lightweight, and open-source SSH & SFTP manager and terminal multiplexer built with **Tauri v2 (Rust)**, **Vue 3**, **TypeScript**, and **xterm.js**.

### Added

#### Core Vault & Cryptographic Security
- Master password protection using **Argon2id** key derivation.
- Authenticated per-record encryption using **AES-256-GCM** with a master-wrapped `VaultKey`.
- Guaranteed in-memory wiping of keys, passphrases, and plaintext secrets using **Zeroize**.
- SQLite persistence (`vault.db`) with automatic schema migrations.
- Configurable auto-lock timers with secure master password rotation without re-encrypting inventory records.

#### Inventory & Identity Management
- Hierarchical folder and host organization with custom color indicators and tag filters.
- Native dual SSH key generation in pure Rust (**Ed25519** and **RSA 4096-bit**).
- OpenSSH public key extraction, persistent storage in vault, and 1-click clipboard copy.
- Local operating system SSH Agent integration via `$SSH_AUTH_SOCK` (Linux/macOS) and named pipes (Windows).
- Visual authentication badges in host modals and trees (`Ed25519`, `RSA`, `Agent`, `Password`).

#### Native SSH Config & Known Hosts Importer
- Built-in parser for `~/.ssh/config` supporting `Host`, `HostName`, `User`, `Port`, `IdentityFile`, `ProxyJump`, and wildcards.
- Built-in parser for `~/.known_hosts` with SHA-256 fingerprint verification.
- Trust-on-first-use (TOFU) support and automatic detection of host key changes to prevent MITM attacks.
- Import preview modal with folder selection and selective import.

#### Terminal Multiplexer & Shell Integration
- High-performance binary streaming over `tauri::ipc::Channel<Vec<u8>>` directly to `@xterm/xterm` with WebGL acceleration.
- Local PTY engine using `portable-pty` for Zsh, Bash, and Fish shells.
- Resizable split panes (horizontal and vertical) with persistent layout trees across tab switching.
- **Broadcast Mode**: Replicates keyboard keystrokes simultaneously across all active split panes with visual warning banners.
- **Shell Integration (OSC 133)**: Detects command prompt markers, execution duration in milliseconds, exit code badges (`0` vs error), prompt-to-prompt jumping (`Ctrl+Shift+↑`/`↓`), and 1-click command output copying.
- In-terminal buffer search with regex, case sensitivity, and whole word matching (`Ctrl+F`).

#### SSH Tunnels & Port Forwarding Manager
- Visual manager for **Local Forwarding (`-L`)**, **Remote Forwarding (`-R`)**, and **Dynamic SOCKS5 Proxy (`-D`)**.
- Multiplexed channel forwarding without opening additional TCP connections.
- Background Tokio actors with real-time tunnel status monitoring and traffic byte counters.

#### Integrated SFTP Explorer & File Transfer
- Dedicated SFTP subsystem client over the authenticated SSH session (`russh-sftp`).
- Directory tree exploration with breadcrumbs, file search filtering, and UNIX permission badges.
- Remote file operations: folder creation (`mkdir`), item renaming, deletion, and property inspection.
- Asynchronous transfer queue with progress tracking (speed, percentage, transferred bytes) for background uploads and downloads.
- Prominent SFTP entry points across host trees, active terminal tab bars, top navigation headers, and the Quick Connect palette.

#### Live Telemetry & System Monitoring
- Non-invasive remote system monitoring reading Linux pseudo-filesystems (`/proc/stat`, `/proc/meminfo`, `/proc/net/dev`, `df`, `/proc/uptime`, `/proc/loadavg`) over an SSH exec channel.
- Real-time differential calculation for CPU usage percentage, RAM/Swap usage, root disk capacity, network throughput (Rx/Tx kB/s), load averages, and uptime.
- Compact `TelemetryBar` integrated into remote terminal panes with color-coded severity indicators (green < 70%, amber 70–85%, red > 85%), pause/resume controls, and configurable polling intervals.

#### Command Snippets Library
- Interactive snippet library with parameter placeholders (`{{variable}}`).
- Dynamic parameter substitution modal before executing commands into the active terminal.
- Tag filtering and quick insert shortcuts.

#### Theming, Desktop Integration & UX
- Native **System Tray (Bandeja del Sistema)** integration supporting KDE Plasma (StatusNotifierItem), GNOME, Windows, and macOS.
- Close-to-tray window interception (`WindowEvent::CloseRequested`) allowing background SSH tunnels and SFTP transfers to continue running when closing the main window.
- System tray context menu with "Mostrar NexusTerm" and "Salir" actions, plus single left-click toggle to restore or hide.
- Configurable "Minimizar a la bandeja al cerrar" preference in General Settings.
- 6 built-in themes: Midnight Dark, Cyberpunk Neon, Nord Frost, Solarized Dark, Monokai Pro, and Light Clean.
- Quick Connect palette (`Ctrl+K`) for lightning-fast server, snippet, and tool discovery.
- Collapsible sidebar (`Ctrl+B`) with integrated tab-bar toggle.
- Linux Wayland and X11 native integration with GTK Application ID (`dev.nexusterm.app`) and window icons.

### Packaging
- Linux packages: `.AppImage` (universal portable), `.deb` (Debian/Ubuntu/Mint), `.rpm` (Fedora/RHEL/openSUSE), and native release binaries.
- Strict **GNU GPLv3** and FOSS license compliance across all Rust crates and npm dependencies.
