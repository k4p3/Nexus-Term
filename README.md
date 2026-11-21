# NexusTerm (`nexus-term`)

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="NexusTerm Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>Modern, lightweight, zero-knowledge SSH/SFTP connection manager and high-performance terminal emulator.</strong><br>
  Built with <strong>Tauri v2</strong>, <strong>Rust</strong>, <strong>Vue 3</strong>, <strong>TypeScript</strong>, <strong>Tailwind CSS v4</strong>, and <strong>xterm.js WebGL</strong>.
</p>

<p align="center">
  <a href="#license"><img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="License: GPLv3"></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-2021%2F2024-orange.svg" alt="Rust"></a>
  <a href="https://v2.tauri.app/"><img src="https://img.shields.io/badge/Tauri-v2-24C8D8.svg" alt="Tauri v2"></a>
  <a href="https://vuejs.org/"><img src="https://img.shields.io/badge/Vue-3.5-42b883.svg" alt="Vue 3"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-3178C6.svg" alt="TypeScript"></a>
  <a href="https://vitest.dev/"><img src="https://img.shields.io/badge/Tests-Vitest%20%7C%20Cargo-brightgreen.svg" alt="Tests"></a>
</p>

<p align="center">
  <strong>English</strong> | <a href="README.es.md">Español</a>
</p>

<p align="center">
  🌐 <a href="https://k4p3.github.io/Nexus-Term/en/index.html"><strong>Website &amp; usage guide</strong></a>
</p>

---

## Overview

**NexusTerm** is designed to deliver a modern, intuitive, and feature-rich server management experience (comparable to *Termius*, *Tabby*, or *MobaXterm*) while remaining **100% free and open-source (FOSS)**, privacy-focused, and ultra-lightweight on memory.

Engineered natively with **Tauri v2** and **Rust**, it eliminates the heavy RAM footprint typical of traditional Electron-based terminals. It is specifically optimized for **Linux (Manjaro KDE Plasma on Wayland/X11)**, while providing first-class cross-platform support for **Windows** and **macOS**.

---

## Key Features

### 🔐 Zero-Knowledge Encrypted Vault
- **Argon2id Key Derivation**: Master passwords are never written to disk. Key derivation uses 64 MiB RAM, 3 iterations, and 4 parallel threads for state-of-the-art GPU brute-force resistance.
- **Authenticated AES-256-GCM**: Every host credential and SSH key is encrypted individually with a distinct 96-bit initialization vector (IV).
- **Wrapped VaultKey Architecture**: Master passwords can be updated seamlessly without needing to decrypt and re-encrypt the entire server database.
- **Secure Memory Cleanup (`zeroize`)**: Cryptographic keys in Rust memory are immediately scrubbed upon vault lock or window close.
- **Lazy Unlock**: NexusTerm opens straight into a local terminal and only asks for the master password when you use saved hosts or credentials (optional *ask at startup* setting). Locking never closes your open sessions; it only blocks new credentialed connections.
- **Auto-Lock**: Locks the vault after a configurable period of keyboard/mouse inactivity (10 minutes by default, can be turned off).

### 🖥️ High-Performance Terminal & Multiplexing
- **Hardware-Accelerated WebGL Rendering**: 60+ FPS rendering powered by `@xterm/addon-webgl` with automatic Canvas 2D fallback.
- **Direct Binary Streaming**: Terminal input and output flow over raw `Vec<u8>` Tauri binary channels, bypassing JSON serialization overhead.
- **Recursive Split Panes & Tab Docking**: Split any workspace vertically or horizontally without limits. Easily open a local terminal, duplicate current hosts, pick from inventory, or move existing open tabs into panes without restarting sessions.
- **Nerd Fonts & Powerline Ready**: Native support for icons and fonts such as *MesloLGS NF*, *Hack Nerd Font*, *JetBrains Mono*, and *Fira Code*.

### ⚡ Advanced Power Tools
- **Shell Integration (OSC 133)**: Semantic prompt detection for Zsh, Bash, and Fish. Visual indicators show command exit codes (`0` vs. errors), execution runtime (e.g., `⏱ 2.1s`), and enable instant prompt navigation (`Ctrl+Shift+↑/↓`). Each command is a **block** tracked with xterm markers (so it stays correct when the scrollback is trimmed): click its ✓/✗ marker to select it, copy its command or output, search only inside it, or re-run it (`Ctrl+Shift+R`).
- **Broadcast / Multi-Exec Mode (`Ctrl+Shift+B`)**: Type once and stream keystrokes across all split panes simultaneously—ideal for clustered server updates.
- **Parameterized Snippet Library**: Store common Docker, Kubernetes, Git, and administration commands with `{{placeholders}}` that prompt for inputs on execution.
- **Buffer Search (`Ctrl+F`)**: High-speed buffer searching with regex matching and result highlighting.
- **Interactive Smart Links**: URLs (`https://`) open on click; file paths (`src/main.rs:10:5`) and IP addresses open a context menu with `Ctrl`+click (copy, show in SFTP, connect via SSH).
- **Quick Select (`Ctrl+Shift+Space`)**: Highlights URLs, paths, git hashes, IPs, UUIDs and e-mails on screen with keyboard labels. Type the label to copy it; hold `Shift` to paste it into the prompt.
- **Terminal Command Palette (`Ctrl+Shift+P`)**: Fuzzy-search every terminal action, theme and snippet, with its shortcut shown next to it.
- **Safe Paste & Paste History (`Ctrl+Alt+V`)**: Multi-line pastes, dangerous commands (`sudo`, `rm -rf`, `curl | sh`…) and hidden control characters ask for confirmation with a preview. The paste history lives in memory only and is wiped when the vault locks.
- **Per-Host Command History (`Ctrl+Shift+H`)**: Commands detected through shell integration are stored per host, encrypted with the vault key, and searchable with a fuzzy picker together with your snippets. `Enter` inserts the command, `Ctrl+Enter` runs it (dangerous commands still ask for confirmation). Commands starting with a space or that look like secrets are never recorded; clear it per host or entirely from Settings.
- **Instant Replay (`Ctrl+Shift+Y`)**: Each pane keeps its last 5 minutes (8 MiB max) of output in memory only, so you can scrub a read-only timeline and recover what a `clear` or a screen reset wiped. Never written to disk; discarded when the vault locks or the pane closes.
- **Session Restore**: The layout of tabs and split panes (hosts and titles only, never contents or credentials) is saved and offered back after unlocking the vault, as a non-blocking banner when the unlock happened on demand (*Ask* / *Always* / *Never*). Tabs reconnect lazily, when you first open them; missing hosts are skipped.
- **Terminal Compatibility**: Unicode 11 widths (emoji, CJK), **OSC 52** remote copy from `tmux`/`vim` (write-only, max 1 MiB: remote programs can never read your clipboard), inline **sixel / iTerm2 images**, and optional **font ligatures**. Ligatures need a ligature font installed on your system (e.g. JetBrains Mono, Fira Code, Cascadia Code); Settings warns you if the font in use has none. Each of these can be turned off in Settings.
- **Long-Command Notifications**: A desktop notification (or in-app toast) when a command detected through shell integration finishes after a configurable threshold and you are not looking at it. The command text is never included unless you enable it.
- **Shortcut Cheat Sheet (`Ctrl+Shift+/`)**: Every keyboard shortcut grouped by context, generated from a single registry.

### 📁 SFTP File Manager & Transfer Queue
- **Integrated Remote File Explorer**: Browse, create, rename, and delete remote files directly from the collapsible sidebar alongside your active terminal without needing a separate FileZilla or Cyberduck client.
- **Concurrent Transfer Queue**: Upload and download files in the background with real-time transfer progress bars, speed metrics, pause/cancel, and automatic retry handling.
- **Smart Terminal to SFTP Link**: Click or context-click detected remote paths (`/var/log/nginx/error.log`) directly in your terminal buffer to immediately navigate and highlight the file in the SFTP panel.

### 🌐 Port Forwarding & Jump Hosts (Bastions)
- **Visual SSH Tunnel Manager**: Configure and monitor Local (`-L`), Remote (`-R`), and Dynamic SOCKS5 (`-D`) port forwarding with dedicated active/inactive visual status pills.
- **Transparent Jump Host Chaining**: Effortlessly traverse private corporate networks by chaining multiple bastion servers (`A -> B -> Target`) using native Rust `direct-tcpip` multiplexing without third-party proxies.

### 🖱️ Graphical Remote Desktops (RDP & VNC)
- **Embedded Desktop Tabs & Split Panes**: Connect to Windows remote desktops via **RDP** (Network Level Authentication / TLS) and Linux/macOS desktops via **VNC** directly inside workspace tabs alongside your command-line shells.
- **Trust-On-First-Use (TOFU) Cryptography**: SHA-256 TLS certificate fingerprint verification warns you before submitting credentials to unfamiliar remote hosts.
- **Desktop Controls**: Dedicated toolbar for full-screen toggle, keyboard/pointer capture, and remote `Ctrl+Alt+Del` event dispatch.

### 📊 Real-Time Server Telemetry
- **Zero-Agent Resource Monitor**: Periodically reads `/proc/stat`, `/proc/meminfo`, `df`, and `/proc/net/dev` over the multiplexed SSH channel without installing background agents on the remote host.
- **Non-Intrusive Telemetry Bar**: Live CPU load, RAM utilization, root disk percentage, and network bandwidth (RX/TX) displayed right at the bottom border of your terminal pane.

### 🧰 Native Desktop & OpenSSH Integration
- **System Tray & Background Persistence**: Native StatusNotifierItem (KDE/Linux), Windows System Tray, and macOS menu bar item. "Close to tray" mode keeps long-running SFTP transfers and active tunnels alive in the background.
- **1-Click OpenSSH Importer**: Instantly import existing server profiles, identities, hostnames, and known hosts from `~/.ssh/config` and `~/.ssh/known_hosts`.
- **Ultra-Lightweight & Lazy Loaded**: Under 20 MB production binary with LLVM LTO and symbol stripping; secondary components (SFTP, RDP/VNC, tunnels, settings, snippets) are loaded on-demand via `defineAsyncComponent` to keep baseline RAM footprint low.

### 🎨 Full-App Theming & Personalization
- **Synchronized Global Theming**: Switching color schemes applies not only to the terminal buffer, but seamlessly across all application UI elements (title bar, sidebar, tabs, modals, and split borders).
- **Built-in Presets**: *Tokyo Night*, *One Dark*, *Dracula*, *Catppuccin Macchiato*, *Nord*, and *KDE Breeze Dark*, plus automatic dynamic color derivation for imported custom schemes.
- **Internationalization (i18n)**: Built-in support for English and Spanish, with plug-and-play community JSON translation files.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│               Frontend: Vue 3 + TypeScript            │
│  Pinia Stores (Vault, Sessions, SFTP, Snippets, Tunnels)│
│       xterm.js WebGL Buffer  │  Tailwind CSS v4        │
└───────────────────────────┬────────────────────────────┘
                            │ Tauri v2 IPC Channels
                            │ (Binary Streams Vec<u8>)
┌───────────────────────────▼────────────────────────────┐
│                    Backend: Rust Core                  │
├──────────────────────────┬─────────────────────────────┤
│   SSH Engine (russh)     │   Local PTY (portable-pty)  │
│   • PTY Channel          │   • Zsh / Bash / Fish       │
│   • SFTP Subsystem       │   • PowerShell / WSL        │
│   • Direct / Jump Hosts  ├─────────────────────────────┤
│   • Background Telemetry │   Encrypted Vault (SQLite)  │
│                          │   • Argon2id + AES-256-GCM  │
└──────────────────────────┴─────────────────────────────┘
```

---

## Keyboard Shortcuts

| Shortcut | Action | Context |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd> | Quick Connect Palette | Global |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> / <kbd>Cmd</kbd> + <kbd>B</kbd> | Toggle Server Tree Sidebar | Global |
| <kbd>Ctrl</kbd> + <kbd>,</kbd> / <kbd>Cmd</kbd> + <kbd>,</kbd> | Settings & Preferences Modal | Global |
| <kbd>Ctrl</kbd> + <kbd>F</kbd> / <kbd>Cmd</kbd> + <kbd>F</kbd> | Search Terminal Buffer | Active Terminal |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> / <kbd>D</kbd> | Split Horizontally (Duplicate Session) | Active Terminal |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd> | Split Vertically (Duplicate Session) | Active Terminal |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>W</kbd> | Close Active Pane | Active Terminal |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> | Toggle Broadcast Mode | Workspace |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>↑</kbd> | Jump to Previous Command Prompt | Shell Integration |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>↓</kbd> | Jump to Next Command Prompt | Shell Integration |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd> | Copy Selected Text | Active Terminal |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd> | Paste from Clipboard (with safe-paste check) | Active Terminal |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Space</kbd> | Quick Select (copy on-screen tokens with labels) | Active Terminal |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | Terminal Command Palette | Workspace |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>V</kbd> | Paste History | Active Terminal |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd> | Per-Host Command History (`Enter` inserts, `Ctrl+Enter` runs) | Active Terminal |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> | Re-run the command of the selected (or last) block | Shell Integration |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Y</kbd> | Instant Replay (review recent output after a `clear`) | Active Terminal |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>/</kbd> | Keyboard Shortcuts Cheat Sheet | Global |
| <kbd>Escape</kbd> | Dismiss Active Modals / Dropdowns | Global |

---

## Installation & Distribution

NexusTerm provides pre-built packages for major Linux distributions, Windows, and macOS:

### 🐧 Linux

#### Arch Linux / Manjaro (AUR)
Install using `yay`, `paru`, or the graphical Pamac package manager:
```bash
yay -S nexus-term-bin
# or
paru -S nexus-term-bin
```

#### Universal Flatpak (Flathub)
Install via Flathub on any Linux distribution (KDE Discover / GNOME Software):
```bash
flatpak install flathub dev.nexusterm.app
flatpak run dev.nexusterm.app
```

#### AppImage & Direct Packages
Download the standalone `.AppImage`, `.deb` (Debian/Ubuntu), or `.rpm` (Fedora/RHEL) from [GitHub Releases](https://github.com/k4p3/Nexus-Term/releases):
```bash
chmod +x nexus-term_*_amd64.AppImage
./nexus-term_*_amd64.AppImage
```

### 🪟 Windows & 🍎 macOS
Pre-compiled installers (`.msi`, `.exe`, `.dmg`) are available directly on the [GitHub Releases](https://github.com/k4p3/Nexus-Term/releases) page.

---

## Getting Started

### Prerequisites

- **Node.js**: `v20+` and **pnpm** `v9+`
- **Rust**: `stable` (MSRV 1.77+) with `cargo`
- **Linux Dependencies** (Debian/Ubuntu/Manjaro/Arch):
  ```bash
  # Arch / Manjaro
  sudo pacman -S webkit2gtk-4.1 base-devel openssl
  
  # Ubuntu / Debian
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/nexus-term.git
   cd nexus-term
   ```

2. **Install frontend dependencies**:
   ```bash
   pnpm install
   ```

3. **Launch in development mode**:
   ```bash
   pnpm tauri dev
   ```

### Running Tests

NexusTerm enforces strict automated testing for both frontend and backend before any feature is approved:

```bash
# Run Frontend Unit Tests (Vitest)
pnpm test

# Run Frontend Typecheck & Build Verification
pnpm build

# Run Backend Unit Tests (Rust)
cd src-tauri && cargo test
```

### Production Build

Compile a self-contained, optimized native binary installer (AppImage, `.deb`, `.msi`, `.dmg`):

```bash
pnpm tauri build
```

---

## Documentation & Architecture

- **[Architecture & Technical Blueprint (ARCHITECTURE.md)](ARCHITECTURE.md)**: Deep dive into the layered domain architecture, Tauri IPC binary streaming, zero-knowledge encryption, and extension guidelines.
- **[Features & Shortcuts Manual (docs/FEATURES_MANUAL.md)](docs/FEATURES_MANUAL.md)**: User manual covering split panes, keybindings, semantic prompts, and themes.
- **[Roadmap (docs/ROADMAP.md)](docs/ROADMAP.md)**: Planned work and tentative ideas (not commitments).
- **[Linux Distribution & Release Guide (docs/DISTRIBUTION_AND_RELEASE_GUIDE.md)](docs/DISTRIBUTION_AND_RELEASE_GUIDE.md)**: Setup and publishing guide for AUR, Flathub, Snap Store, and automated CI/CD releases.
- **[AI Agent & SDD Workflow (AGENTS.md)](AGENTS.md)**: Specification-Driven Development (OpenSpec) rules, license compliance, and testing policy.

---

## Security & Privacy Policy

- **Zero Telemetry / Zero Phone Home**: NexusTerm never collects analytics or sends telemetry data to remote servers.
- **Local-First Storage**: All encrypted databases reside exclusively on your local machine (`vault.db`).
- **Cryptographic Rigor**: Passwords and private keys are encrypted at rest using industry-standard authenticated ciphers and wiped from system memory on shutdown.

---

## License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**.  
See the [LICENSE](LICENSE) file for complete details.
