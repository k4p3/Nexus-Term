# Proposal

## Why

En Linux (especialmente en entornos como Manjaro con KDE Plasma) existe una carencia de gestores de conexiones SSH modernos, rápidos y libres: las alternativas tradicionales como Remmina tienen una interfaz desactualizada o pensada para escritorio remoto, mientras que opciones modernas como Termius requieren suscripción de pago y consumen muchos recursos con Electron. Esta primera fase establece los cimientos arquitectónicos de **NexusTerm (`nexus-term`)** con Tauri v2 + Rust + Vue 3, entregando un MVP funcional con bóveda cifrada local, inventario de hosts y emulador de terminal acelerado por GPU con pestañas y paneles divididos.

## What Changes

- **Inicialización de Arquitectura Base**: Configuración del workspace con Tauri v2 (Rust) en el backend y Vue 3 + TypeScript + Pinia + Tailwind CSS en el frontend.
- **Motor de Bóveda Cifrada (`vault-security`)**: Implementación de persistencia en SQLite (`vault.db`) con derivación de clave maestra mediante `Argon2id`, cifrado autenticado por registro (`AES-256-GCM`) de una `VaultKey` envuelta, y limpieza segura de memoria (`zeroize`).
- **Inventario de Hosts e Identidades (`host-inventory`)**: CRUD completo de carpetas jerárquicas, servidores (hosts), etiquetas (tags) y credenciales reutilizables (contraseña o llave privada SSH), con buscador rápido (`Ctrl+K`).
- **Motor de Terminal y Multiplexación (`terminal-multiplexer`)**: Conexiones SSH2 nativas en Rust mediante `russh` y terminales de shell local mediante `portable-pty`, transmitiendo flujos binarios a través de `tauri::ipc::Channel` hacia instancias de `@xterm/xterm` (WebGL) organizadas en pestañas y paneles divididos (*split panes*).
- **Fuera de Alcance (Out of Scope para Fase 1)**: Explorador SFTP visual (Fase 3), gestor visual de túneles de puertos, telemetría en vivo, Broadcast (Fase 4) y sincronización remota BYOC (Fase 5).

## Capabilities

### New Capabilities
- `vault-security`: Inicialización, desbloqueo, cambio de contraseña maestra, bloqueo en memoria (`zeroize`) y cifrado/descifrado autenticado (`Argon2id` + `AES-256-GCM`) de secretos en SQLite.
- `host-inventory`: Gestión de carpetas, hosts, etiquetas e identidades de autenticación reutilizables, incluyendo búsqueda rápida.
- `terminal-multiplexer`: Sesiones interactivas SSH (`russh`) y PTY local (`portable-pty`), streaming binario por canales IPC de Tauri, verificación de huella `known_hosts` (TOFU) y vista de pestañas / *split panes* con `xterm.js`.

### Modified Capabilities

## Impact

- **Backend (`src-tauri/`)**: Creación de los módulos `vault`, `hosts`, `ssh` y `pty`, integrando `rusqlite`, `argon2`, `aes-gcm`, `zeroize`, `russh`, `russh-keys`, `portable-pty` y `tokio`.
- **Frontend (`src/`)**: Creación de stores Pinia (`vault.store.ts`, `sessions.store.ts`), vistas de bloqueo/desbloqueo de bóveda, árbol lateral de hosts y contenedor de pestañas/split panes con `@xterm/xterm`.
