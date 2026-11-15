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

### 🖥️ High-Performance Terminal & Multiplexing
- **Hardware-Accelerated WebGL Rendering**: 60+ FPS rendering powered by `@xterm/addon-webgl` with automatic Canvas 2D fallback.
- **Direct Binary Streaming**: Terminal input and output flow over raw `Vec<u8>` Tauri binary channels, bypassing JSON serialization overhead.
- **Recursive Split Panes & Tab Docking**: Split any workspace vertically or horizontally without limits. Easily open a local terminal, duplicate current hosts, pick from inventory, or move existing open tabs into panes without restarting sessions.
- **Nerd Fonts & Powerline Ready**: Native support for icons and fonts such as *MesloLGS NF*, *Hack Nerd Font*, *JetBrains Mono*, and *Fira Code*.

### ⚡ Advanced Power Tools
- **Shell Integration (OSC 133)**: Semantic prompt detection for Zsh, Bash, and Fish. Visual indicators show command exit codes (`0` vs. errors), execution runtime (e.g., `⏱ 2.1s`), and enable instant prompt navigation (`Ctrl+Shift+↑/↓`).
- **Broadcast / Multi-Exec Mode (`Ctrl+Shift+B`)**: Type once and stream keystrokes across all split panes simultaneously—ideal for clustered server updates.
- **Parameterized Snippet Library**: Store common Docker, Kubernetes, Git, and administration commands with `{{placeholders}}` that prompt for inputs on execution.
- **Buffer Search (`Ctrl+F`)**: High-speed buffer searching with regex matching and result highlighting.
- **Interactive Smart Links**: Clickable URLs (`https://`), file paths (`src/main.rs:10`), and IP addresses with one-click SSH context menus.

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
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd> | Paste from Clipboard | Active Terminal |
| <kbd>Escape</kbd> | Dismiss Active Modals / Dropdowns | Global |

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

## Security & Privacy Policy

- **Zero Telemetry / Zero Phone Home**: NexusTerm never collects analytics or sends telemetry data to remote servers.
- **Local-First Storage**: All encrypted databases reside exclusively on your local machine (`vault.db`).
- **Cryptographic Rigor**: Passwords and private keys are encrypted at rest using industry-standard authenticated ciphers and wiped from system memory on shutdown.

---

## License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**.  
See the [LICENSE](LICENSE) file for complete details.
