# AGENTS.md — Guía para Agentes de IA y Desarrollo Guiado por Especificaciones (SDD)

Bienvenido al repositorio de **NexusTerm (`nexus-term`)**, nuestro **Gestor SSH, SFTP y Terminal Multiplataforma** construido con **Tauri v2 (Rust) + Vue 3 + TypeScript + xterm.js**.

Este proyecto sigue estrictamente la metodología **SDD (Spec-Driven Development / Desarrollo Guiado por Especificaciones)** apoyada en **OpenSpec**. Ninguna funcionalidad nueva o cambio arquitectónico debe programarse directamente "al vuelo" sin antes contar con su especificación y lista de tareas aprobada.

---

## 1. Flujo de Trabajo SDD con OpenSpec

Este repositorio contiene la estructura oficial de **OpenSpec** en `openspec/` y los flujos para agentes en `.agents/`.

### Ciclo de Vida Obligatorio
1. **Explorar (`/opsx-explore`)**: Analizar requerimientos, investigar crates de Rust o componentes de Vue sin modificar código de producción.
2. **Proponer (`/opsx-propose "<nombre-del-cambio>"`)**:
   - Crea un cambio aislado en `openspec/changes/<nombre-del-cambio>/` usando el CLI `openspec`.
   - Genera los 4 artefactos requeridos antes de tocar código:
     - `proposal.md`: Qué se va a construir, por qué y qué capacidades afecta.
     - `specs/<capacidad>/spec.md`: Especificaciones delta con requisitos normativos (`SHALL`/`MUST`) y escenarios verificables (`WHEN`/`THEN`).
     - `design.md`: Decisiones técnicas, contratos Tauri IPC, esquemas SQLite y flujos de datos.
     - `tasks.md`: Lista de tareas secuenciales con casillas de verificación (`- [ ] 1.1 ...`).
   - **Regla de Oro**: Detenerse tras crear o actualizar la propuesta y esperar la revisión/aprobación del usuario antes de pasar a la implementación.
3. **Implementar (`/opsx-apply`)**:
   - Leer `proposal.md`, `specs/`, `design.md` y ejecutar paso a paso las tareas de `tasks.md`.
   - Marcar cada tarea como completada (`- [x]`) a medida que se verifica su compilación y funcionamiento.
4. **Sincronizar y Validar (`/opsx-sync` + `openspec validate`)**:
   - Ejecutar `openspec validate` para comprobar que las especificaciones delta y principales cumplen las reglas formales.
5. **Archivar (`/opsx-archive`)**:
   - Una vez completadas todas las tareas, fusionar las especificaciones delta en `openspec/specs/` (la fuente de la verdad viva del sistema) y mover el cambio a `openspec/changes/archive/`.

### Comandos Útiles de OpenSpec CLI
```bash
openspec status --change "<nombre>"   # Ver estado de artefactos de un cambio
openspec validate                     # Validar formato de todas las specs y cambios activos
openspec list                         # Listar cambios activos
openspec list --specs                 # Listar especificaciones vivas del sistema
openspec view                         # Panel interactivo de especificaciones y cambios
```

> **Nota sobre el idioma en OpenSpec**: Todo el contenido descriptivo se escribe en **español**, pero las cabeceras estructurales de OpenSpec (`## ADDED Requirements`, `## MODIFIED Requirements`, `### Requirement:`, `#### Scenario:`) y las palabras clave (`SHALL`, `MUST`, `WHEN`, `THEN`, `AND`) **deben mantenerse en inglés** para que el validador formal (`openspec validate`) las reconozca.

---

## 2. Visión y Stack Tecnológico

El objetivo es ofrecer una experiencia moderna estilo *Termius* / *Tabby* / *MobaXterm*, pero 100% libre, ligera en RAM y perfectamente integrada en **Linux (Manjaro KDE Plasma)**, Windows y macOS.

### Frontend (`src/`)
- **Framework**: Vue 3 (Composition API con `<script setup lang="ts">`) + TypeScript estricto.
- **Estado**: Pinia (`src/stores/`):
  - `vault.store.ts`: Estado de bloqueo/desbloqueo de bóveda, carpetas, hosts e identidades.
  - `sessions.store.ts`: Árbol de pestañas, *split panes* (paneles divididos), sesiones activas y modo *Broadcast*.
  - `sftp.store.ts`: Estado del explorador SFTP (barra lateral acoplada + vista de doble panel y cola de transferencias).
  - `tunnels.store.ts`: Estado de túneles de puertos (`Local -L`, `Remote -R`, `Dynamic SOCKS5 -D`).
  - `snippets.store.ts`: Snippets de comandos e historial/autocompletado.
- **UI & Estilos**: Tailwind CSS v4 + Radix Vue (`reka-ui` / `shadcn-vue`) + iconos `lucide-vue-next`.
- **Terminal**: `@xterm/xterm` con `@xterm/addon-webgl`, `@xterm/addon-fit`, `@xterm/addon-search` y `@xterm/addon-web-links`.

### Backend (`src-tauri/`)
- **Core**: Rust (Edición 2021/2024) + **Tauri v2** + runtime asíncrono **Tokio**.
- **Motor SSH & Multiplexación (`src-tauri/src/ssh/`)**:
  - Basado en `russh`, `russh-keys` y `russh-sftp`.
  - **Multiplexación**: Una única conexión TCP/SSH autenticada por sesión sirve simultáneamente para:
    1. Canal interactivo PTY (conectado a `xterm.js` mediante `tauri::ipc::Channel<Vec<u8>>`).
    2. Canal subsistema SFTP (`russh-sftp`).
    3. Canal de telemetría ligera (`exec` periódico leyendo `/proc/stat`, `/proc/meminfo`, `df`, `/proc/net/dev`).
    4. Canales `direct-tcpip` y `forwarded-tcpip` para Port Forwarding y **Jump Hosts (Bastion)** encadenados.
- **Motor PTY Local (`src-tauri/src/pty/`)**:
  - Basado en `portable-pty` para terminales locales (Zsh/Bash/Fish en Linux, PowerShell/WSL en Windows) y fallback opcional al binario OpenSSH del sistema.
- **Bóveda Cifrada (`src-tauri/src/vault/`)**:
  - Persistencia en SQLite (`vault.db`).
  - Derivación de clave maestra con **`argon2` (Argon2id)**.
  - Cifrado autenticado por registro con **`aes-gcm` (AES-256-GCM)** utilizando una `VaultKey` envuelta, lo que permite cambiar la contraseña maestra sin recifrar cada registro y facilita la sincronización sin conflictos binarios.
  - Limpieza obligatoria de memoria sensible con **`zeroize`**.
- **Sincronización BYOC (`src-tauri/src/sync/`)**:
  - Sincronización sin servidor propio mediante exportación/importación diferencial de registros cifrados hacia carpeta local (Syncthing/Nextcloud), WebDAV o Git.

---

## 3. Estructura de Directorios del Proyecto

```text
terminal/
├── AGENTS.md                  # Instrucciones maestras para agentes de IA (este archivo)
├── ARCHITECTURE.md            # Guía de arquitectura oficial y referencia técnica por capas
├── openspec/                  # Especificaciones vivas y propuestas de cambio (SDD)
│   ├── config.yaml            # Configuración y reglas de OpenSpec
│   ├── specs/                 # Especificaciones vigentes por módulo (Fuente de la verdad)
│   └── changes/               # Cambios activos y archivo histórico (archive/)
├── .agents/                   # Skills y workflows de OpenSpec para el agente
├── src/                       # Frontend Vue 3 + TypeScript
│   ├── components/
│   │   ├── terminal/          # XtermView, SplitPaneContainer, TelemetryBar
│   │   ├── hosts/             # HostTreeSidebar, HostModal, QuickConnectModal (Ctrl+K)
│   │   ├── sftp/              # SftpSidebar, SftpDualPane, TransferQueue
│   │   ├── tunnels/           # PortForwardManager
│   │   ├── snippets/          # SnippetLibrary, BroadcastBar
│   │   └── vault/             # VaultUnlockScreen, KeyGeneratorModal
│   ├── stores/                # Stores de Pinia
│   ├── services/              # Clientes tipados para comandos y canales IPC de Tauri
│   └── types/                 # Interfaces TypeScript espejadas con los structs de Rust
└── src-tauri/                 # Backend Rust (Tauri v2)
    ├── Cargo.toml
    └── src/
        ├── main.rs / lib.rs   # Punto de entrada y registro de comandos Tauri
        ├── vault/             # Criptografía (Argon2id, AES-GCM, Zeroize) y SQLite
        ├── ssh/               # Cliente russh, Jump Hosts, canales PTY, SFTP y Telemetría
        ├── pty/               # Sesiones locales con portable-pty
        ├── tunnels/           # Port forwarding Local (-L), Remoto (-R) y Dinámico SOCKS5 (-D)
        ├── ssh_config/        # Parser de ~/.ssh/config y ~/.ssh/known_hosts
        └── sync/              # Sincronización BYOC (Archivo local / Git / WebDAV)
```

---

## 4. Reglas de Seguridad y Calidad de Código

1. **Cero Secretos en Texto Plano**:
   - Ninguna contraseña, llave privada SSH o passphrase debe guardarse sin cifrar en SQLite, `localStorage` ni mostrarse en `println!` / `tracing` / `console.log`.
   - El frontend nunca almacena la clave maestra; solo invoca comandos de Rust mientras la bóveda está desbloqueada en la memoria de Rust.
2. **Streaming Binario para la Terminal**:
   - No usar eventos JSON lentos para el tráfico de la terminal. Usar siempre `tauri::ipc::Channel` para enviar chunks de bytes (`Vec<u8>`) desde el PTY/SSH hacia `xterm.write(Uint8Array)`.
3. **Manejo de Errores Explícito**:
   - En Rust, prohibido usar `.unwrap()` o `.expect()` en rutas de red, archivos o criptografía; usar tipos de error estructurados con `thiserror` serializables hacia el frontend.
4. **Diseño UI para Linux / KDE Plasma**:
   - Priorizar navegación completa por teclado (atajos configurables, `Ctrl+K` para paleta de comandos), tema oscuro de alto contraste, baja latencia de entrada y redimensionado fluido de paneles.
5. **Pruebas Automatizadas Obligatorias (Testing Policy)**:
   - Todo cambio, nueva funcionalidad o corrección DEBE incluir obligatoriamente sus pruebas unitarias correspondientes antes de darse por completado.
   - **Backend (Rust)**: Cada módulo de bóveda, criptografía, inventario, túneles, settings, snippets o comandos debe contar con pruebas unitarias (`#[cfg(test)]`) verificables con `cd src-tauri && cargo test`.
   - **Frontend (Vue 3 / TypeScript)**: Toda tienda de Pinia (`src/stores/`), algoritmo de utilidad o lógica de negocio en el frontend debe contar con pruebas unitarias (`.test.ts`) ejecutadas y aprobadas con `pnpm test` (Vitest). Asimismo, la comprobación estricta de tipos (`vue-tsc --noEmit`) y la compilación (`vite build`) deben pasar con cero errores.
   - **Criterio de Aceptación Inmutable**: Queda terminantemente prohibido archivar un cambio (`/opsx-archive`) o dar por terminada una tarea si falla alguna prueba unitaria en backend o frontend.
6. **Cumplimiento Estricto de Licencias Libres (FOSS & GPLv3 Compliance)**:
   - Todo nuevo crate de Rust, paquete de npm, icono o recurso externo que se incorpore al proyecto DEBE poseer obligatoriamente una licencia de código abierto compatible con **GNU GPLv3** (tales como MIT, Apache-2.0, BSD-2/3-Clause, ISC, BlueOak-1.0.0, MPL-2.0, Unlicense o Dominio Público).
   - Queda terminantemente prohibido incorporar dependencias privativas, de código cerrado, bajo licencias con restricciones de uso comercial (ej. CC-BY-NC, SSPL, Commons Clause, BSL) o incompatibles con GPLv3.
   - En cada propuesta de cambio (`proposal.md` / `design.md`) que introduzca nuevas dependencias, se debe documentar y verificar explícitamente la licencia de cada paquete agregado.

---

## 5. Reglas de Git y Mensajes de Commit

1. **Idioma Estrictamente en Inglés**:
   - Todos los mensajes de commit deben redactarse en **inglés** siguiendo la convención *Conventional Commits* (ej. `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `test: ...`).
2. **Cero Coautorías o Menciones a IA**:
   - Está terminantemente prohibido incluir pies de página o líneas de coautoría (como `Co-authored-by:`, `Signed-off-by:`, menciones a asistentes, modelos o herramientas de IA).
   - Los commits deben atribuirse única y exclusivamente al autor configurado en el entorno de Git del usuario.
