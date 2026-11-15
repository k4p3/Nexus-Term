# NexusTerm (`nexus-term`)

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Logo de NexusTerm" width="96" height="96" />
</p>

<p align="center">
  <strong>Gestor moderno, ligero y Zero-Knowledge de conexiones SSH/SFTP y emulador de terminal de alto rendimiento.</strong><br>
  Construido con <strong>Tauri v2</strong>, <strong>Rust</strong>, <strong>Vue 3</strong>, <strong>TypeScript</strong>, <strong>Tailwind CSS v4</strong> y <strong>xterm.js WebGL</strong>.
</p>

<p align="center">
  <a href="#licencia"><img src="https://img.shields.io/badge/Licencia-GPLv3-blue.svg" alt="Licencia: GPLv3"></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-2021%2F2024-orange.svg" alt="Rust"></a>
  <a href="https://v2.tauri.app/"><img src="https://img.shields.io/badge/Tauri-v2-24C8D8.svg" alt="Tauri v2"></a>
  <a href="https://vuejs.org/"><img src="https://img.shields.io/badge/Vue-3.5-42b883.svg" alt="Vue 3"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-3178C6.svg" alt="TypeScript"></a>
  <a href="https://vitest.dev/"><img src="https://img.shields.io/badge/Pruebas-Vitest%20%7C%20Cargo-brightgreen.svg" alt="Pruebas"></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>Español</strong>
</p>

---

## Propósito y Visión

**NexusTerm** nace para ofrecer una experiencia moderna, fluida y visualmente atractiva en la administración de servidores (comparable a herramientas como *Termius*, *Tabby* o *MobaXterm*), pero siendo **100% software libre (FOSS)**, enfocado en la privacidad total y con un consumo de memoria RAM ultra bajo.

Diseñado de manera nativa sobre **Tauri v2** y **Rust**, elimina el alto consumo de recursos característico de las aplicaciones empaquetadas en Electron. Está optimizado especialmente para **Linux (Manjaro KDE Plasma en Wayland/X11)**, manteniendo soporte de primer nivel para **Windows** y **macOS**.

---

## Funcionalidades Principales

### 🔐 Bóveda Cifrada Zero-Knowledge
- **Derivación de Clave Maestra con Argon2id**: La contraseña maestra nunca se guarda en disco. Utiliza 64 MiB de memoria, 3 iteraciones y 4 hilos paralelos para máxima resistencia contra ataques de fuerza bruta en GPU.
- **Cifrado Autenticado AES-256-GCM**: Cada credencial, servidor y llave privada SSH se cifra individualmente con un vector de inicialización (IV) único de 96 bits.
- **Arquitectura de Clave Envuelta (`VaultKey`)**: La contraseña maestra se puede cambiar en cualquier momento sin necesidad de descifrar y recifrar toda la base de datos de servidores.
- **Limpieza Segura de Memoria (`zeroize`)**: Toda clave sensible en la memoria de Rust se sobrescribe con ceros inmediatamente al bloquear la bóveda o cerrar la aplicación.

### 🖥️ Terminal de Alto Rendimiento y Multiplexación
- **Aceleración por Hardware (WebGL)**: Renderizado fluido a 60+ FPS mediante `@xterm/addon-webgl` con degradación suave automática a Canvas 2D.
- **Streaming Binario Directo**: La entrada y salida de datos fluye mediante canales binarios `Vec<u8>` de Tauri v2, evitando la sobrecarga de serialización JSON.
- **Paneles Divididos Recursivos (*Split Panes*) y Acoplamiento de Pestañas**: Divide cualquier espacio de trabajo vertical u horizontalmente sin límites. Abre terminales locales, duplica servidores, elige hosts del inventario o mueve pestañas abiertas directamente a un panel dividido sin reiniciar sesiones.
- **Compatibilidad con Nerd Fonts y Powerline**: Soporte total para fuentes como *MesloLGS NF*, *Hack Nerd Font*, *JetBrains Mono* y *Fira Code*.

### ⚡ Herramientas Avanzadas (Power Tools)
- **Integración con el Shell (OSC 133)**: Reconocimiento semántico de prompts para Zsh, Bash y Fish. Indica si los comandos terminaron con éxito (`0`) o error, muestra el tiempo de ejecución (ej. `⏱ 2.1s`) y permite saltar entre prompts instantáneamente (`Ctrl+Shift+↑/↓`).
- **Modo Broadcast / Multi-Exec (`Ctrl+Shift+B`)**: Escribe una sola vez y replica tus pulsaciones en todos los paneles divididos activos de la pestaña de forma simultánea.
- **Biblioteca de Snippets con Parámetros**: Guarda comandos frecuentes de Docker, Kubernetes, Git y administración con variables `{{parametro}}` que solicitan valores antes de ejecutarse.
- **Búsqueda en el Buffer (`Ctrl+F`)**: Búsqueda rápida con soporte para expresiones regulares (RegEx) y resaltado interactivo.
- **Enlaces Inteligentes**: Detección interactiva de URLs (`https://`), rutas de código (`src/main.rs:10`) y direcciones IP con menú contextual para conexión SSH en 1 clic.

### 🎨 Tematización Unificada de toda la Aplicación
- **Sincronización Total de Color**: Cambiar de tema actualiza tanto la terminal `xterm.js` como la interfaz completa de la ventana (barra superior, panel de servidores, pestañas, modales y bordes de división).
- **Temas Predefinidos**: *Tokyo Night*, *One Dark*, *Dracula*, *Catppuccin Macchiato*, *Nord* y *KDE Breeze Dark*, además de derivación algorítmica para esquemas de color JSON importados.
- **Internacionalización (i18n)**: Soporte nativo para Español e Inglés, con capacidad de agregar traducciones comunitarias mediante archivos JSON.

---

## Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────┐
│               Frontend: Vue 3 + TypeScript            │
│  Stores Pinia (Vault, Sessions, SFTP, Snippets, Tunnels)│
│       Buffer WebGL xterm.js  │  Tailwind CSS v4        │
└───────────────────────────┬────────────────────────────┘
                            │ Canales IPC Tauri v2
                            │ (Flujos Binarios Vec<u8>)
┌───────────────────────────▼────────────────────────────┐
│                    Backend: Núcleo en Rust             │
├──────────────────────────┬─────────────────────────────┤
│   Motor SSH (russh)      │   PTY Local (portable-pty)  │
│   • Canal PTY            │   • Zsh / Bash / Fish       │
│   • Subsistema SFTP      │   • PowerShell / WSL        │
│   • Jump Hosts / Bastión ├─────────────────────────────┤
│   • Telemetría Ligera    │   Bóveda Cifrada (SQLite)   │
│                          │   • Argon2id + AES-256-GCM  │
└──────────────────────────┴─────────────────────────────┘
```

---

## Atajos de Teclado Esenciales

| Atajo | Acción | Contexto |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd> | Paleta de Conexión Rápida | Global |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> / <kbd>Cmd</kbd> + <kbd>B</kbd> | Alternar Visibilidad de Barra Lateral | Global |
| <kbd>Ctrl</kbd> + <kbd>,</kbd> / <kbd>Cmd</kbd> + <kbd>,</kbd> | Modal de Ajustes y Preferencias | Global |
| <kbd>Ctrl</kbd> + <kbd>F</kbd> / <kbd>Cmd</kbd> + <kbd>F</kbd> | Buscar en el Buffer de la Terminal | Terminal Activa |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> / <kbd>D</kbd> | Dividir Horizontalmente (Duplica sesión) | Terminal Activa |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd> | Dividir Verticalmente (Duplica sesión) | Terminal Activa |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>W</kbd> | Cerrar Panel Activo | Terminal Activa |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> | Activar/Desactivar Modo Broadcast | Espacio de Trabajo |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>↑</kbd> | Saltar al Prompt del Comando Anterior | Shell Integration |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>↓</kbd> | Saltar al Prompt del Comando Siguiente | Shell Integration |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd> | Copiar Texto Seleccionado | Terminal Activa |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd> | Pegar Texto del Portapapeles | Terminal Activa |
| <kbd>Escape</kbd> | Cerrar Modales y Paneles Emergentes | Global |

---

## Instalación y Entorno de Desarrollo

### Requisitos Previos

- **Node.js**: `v20+` y **pnpm** `v9+`
- **Rust**: Versión `stable` (MSRV 1.77+) con `cargo`
- **Dependencias del Sistema en Linux** (Debian/Ubuntu/Manjaro/Arch):
  ```bash
  # Arch / Manjaro
  sudo pacman -S webkit2gtk-4.1 base-devel openssl
  
  # Ubuntu / Debian
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### Puesta en Marcha

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/tu-usuario/nexus-term.git
   cd nexus-term
   ```

2. **Instalar dependencias del frontend**:
   ```bash
   pnpm install
   ```

3. **Ejecutar en modo desarrollo**:
   ```bash
   pnpm tauri dev
   ```

### Pruebas Automatizadas

NexusTerm requiere que las pruebas unitarias de backend y frontend pasen con 100% de éxito:

```bash
# Pruebas Unitarias del Frontend (Vitest)
pnpm test

# Verificación de Tipos y Compilación Frontend
pnpm build

# Pruebas Unitarias del Backend (Rust)
cd src-tauri && cargo test
```

### Compilación para Producción

Genera el paquete ejecutable nativo optimizado (AppImage, `.deb`, `.msi`, `.dmg`):

```bash
pnpm tauri build
```

---

## Documentación y Arquitectura

- **[Guía de Arquitectura y Referencia Técnica (ARCHITECTURE.md)](ARCHITECTURE.md)**: Explicación a fondo de la arquitectura por capas y dominios, streaming binario por Tauri IPC, criptografía zero-knowledge y guía para extender el sistema.
- **[Manual de Funcionalidades y Atajos (docs/FEATURES_MANUAL.md)](docs/FEATURES_MANUAL.md)**: Manual de usuario detallando el uso de split panes, atajos de teclado, prompts semánticos y temas.
- **[Flujo de Desarrollo SDD para Agentes (AGENTS.md)](AGENTS.md)**: Metodología con OpenSpec, cumplimiento estricto de licencias FOSS y política de testing obligatorio.

---

## Seguridad y Privacidad

- **Cero Telemetría**: NexusTerm no recopila métricas ni envía datos de uso a servidores externos.
- **Almacenamiento Local First**: Toda la base de datos cifrada permanece exclusivamente en tu equipo (`vault.db`).
- **Criptografía Robusta**: Las credenciales se protegen con algoritmos autenticados estándar de la industria y la memoria se purga al cerrar.

---

## Licencia

Este proyecto está licenciado bajo la **Licencia Pública General de GNU v3.0 (GPLv3)**.  
Consulta el archivo [LICENSE](LICENSE) para obtener todos los detalles.
