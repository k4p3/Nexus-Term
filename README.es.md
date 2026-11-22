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

<p align="center">
  🌐 <a href="https://k4p3.github.io/Nexus-Term/es/index.html"><strong>Sitio web y guía de uso</strong></a>
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
- **Desbloqueo Bajo Demanda**: NexusTerm abre directamente una terminal local y solo pide la contraseña maestra cuando usas hosts o credenciales guardadas (ajuste opcional *pedir al iniciar*). Bloquear nunca cierra tus sesiones abiertas; solo impide abrir conexiones nuevas con credenciales.
- **Auto-Bloqueo**: Bloquea la bóveda tras un tiempo configurable sin actividad de teclado o ratón (10 minutos por defecto, se puede desactivar).

### 🖥️ Terminal de Alto Rendimiento y Multiplexación
- **Aceleración por Hardware (WebGL)**: Renderizado fluido a 60+ FPS mediante `@xterm/addon-webgl` con degradación suave automática a Canvas 2D.
- **Streaming Binario Directo**: La entrada y salida de datos fluye mediante canales binarios `Vec<u8>` de Tauri v2, evitando la sobrecarga de serialización JSON.
- **Popup de Autocompletado de Comandos**: pulsa `Ctrl+Space` para ver sugerencias junto al cursor, tomadas del historial cifrado del host y de tus snippets habilitados. Sigue escribiendo para filtrar; `↑`/`↓` navegan, `Tab` inserta sin ejecutar y `Esc` cierra. Se desactiva en programas de pantalla completa como `vim`.
- **Navegación de Pestañas por Teclado**: `Ctrl+Shift+T` abre una terminal local, `Ctrl+Tab` / `Ctrl+Shift+Tab` (o `Ctrl+PageDown` / `Ctrl+PageUp`) recorren las pestañas y `Alt+1..9` salta directo a una (`Alt+9` = la última). Además, al iniciar siempre se abre una terminal local si no hay nada que restaurar.
- **Paneles Divididos Recursivos (*Split Panes*) y Acoplamiento de Pestañas**: Divide cualquier espacio de trabajo vertical u horizontalmente sin límites. Abre terminales locales, duplica servidores, elige hosts del inventario o mueve pestañas abiertas directamente a un panel dividido sin reiniciar sesiones.
- **Compatibilidad con Nerd Fonts y Powerline**: Soporte total para fuentes como *MesloLGS NF*, *Hack Nerd Font*, *JetBrains Mono* y *Fira Code*.

### ⚡ Herramientas Avanzadas (Power Tools)
- **Integración con el Shell (OSC 133)**: Reconocimiento semántico de prompts para Zsh, Bash y Fish. Indica si los comandos terminaron con éxito (`0`) o error, muestra el tiempo de ejecución (ej. `⏱ 2.1s`) y permite saltar entre prompts instantáneamente (`Ctrl+Shift+↑/↓`). Cada comando es un **bloque** seguido con *markers* de xterm (sigue siendo correcto al recortarse el scrollback): haz clic en su marca ✓/✗ para seleccionarlo, copiar su comando o su salida, buscar solo dentro de él o repetirlo (`Ctrl+Shift+R`).
- **Modo Broadcast / Multi-Exec (`Ctrl+Shift+B`)**: Escribe una sola vez y replica tus pulsaciones en todos los paneles divididos activos de la pestaña de forma simultánea.
- **Navegación por Teclado entre Paneles (`Alt+←` `Alt+→` `Alt+↑` `Alt+↓`)**: Salta al panel contiguo en esa dirección sin usar el ratón. Si no hay panel en esa dirección, la tecla llega a tu shell sin cambios.
- **Biblioteca de Snippets con Parámetros**: Guarda comandos frecuentes de Docker, Kubernetes, Git y administración con variables `{{parametro}}` que solicitan valores antes de ejecutarse.
- **Búsqueda en el Buffer (`Ctrl+F`)**: Búsqueda rápida con soporte para expresiones regulares (RegEx) y resaltado interactivo.
- **Enlaces Inteligentes**: Las URLs (`https://`) se abren con un clic; las rutas de código (`src/main.rs:10:5`) y las direcciones IP abren un menú contextual con `Ctrl`+clic (copiar, mostrar en SFTP, conectar por SSH).
- **Quick Select (`Ctrl+Shift+Space`)**: Resalta URLs, rutas, hashes de git, IPs, UUID y correos visibles con etiquetas de teclado. Escribe la etiqueta para copiar; con `Shift` pega en el prompt.
- **Paleta de Comandos de la Terminal (`Ctrl+Shift+P`)**: Búsqueda difusa de acciones, temas y snippets, mostrando su atajo.
- **Pegado Seguro e Historial de Pegado (`Ctrl+Alt+V`)**: Los pegados multilínea, los comandos peligrosos (`sudo`, `rm -rf`, `curl | sh`…) y los caracteres de control ocultos piden confirmación con vista previa. El historial de pegado vive solo en memoria y se borra al bloquear la bóveda.
- **Historial de Comandos por Host (`Ctrl+Shift+H`)**: Los comandos detectados por la integración de shell se guardan por host, cifrados con la clave de la bóveda, y se buscan con un selector difuso junto a tus snippets. `Enter` inserta el comando y `Ctrl+Enter` lo ejecuta (los comandos peligrosos siguen pidiendo confirmación). Los comandos que empiezan por espacio o parecen secretos nunca se registran; se puede borrar por host o todo desde Ajustes.
- **Instant Replay (`Ctrl+Shift+Y`)**: Cada panel conserva en memoria sus últimos 5 minutos (máx. 8 MiB) de salida para recorrer una línea de tiempo de solo lectura y recuperar lo que borró un `clear` o un reinicio de pantalla. Nunca se escribe en disco; se descarta al bloquear la bóveda o cerrar el panel.
- **Restauración de Sesiones**: La distribución de pestañas y paneles (solo hosts y títulos, nunca contenido ni credenciales) se guarda y se ofrece restaurar tras desbloquear la bóveda, con un aviso no bloqueante si el desbloqueo fue bajo demanda (*Preguntar* / *Siempre* / *Nunca*). Las pestañas se reconectan de forma diferida, al abrirlas por primera vez; los hosts que ya no existen se omiten.
- **Compatibilidad de Terminal**: Anchos Unicode 11 (emoji, CJK), copia remota **OSC 52** desde `tmux`/`vim` (solo escritura, máx. 1 MiB: los programas remotos nunca pueden leer tu portapapeles), **imágenes sixel / iTerm2** en línea y **ligaduras de tipografía** opcionales. Las ligaduras requieren una fuente con ligaduras instalada en el sistema (p. ej. JetBrains Mono, Fira Code, Cascadia Code); Ajustes avisa si la fuente en uso no las tiene. Cada una se puede desactivar en Ajustes.
- **Notificaciones de Comandos Largos**: Aviso de escritorio (o *toast* interno) cuando un comando detectado por la integración de shell termina tras un umbral configurable y no lo estás mirando. El texto del comando nunca se incluye salvo que lo actives.
- **Hoja de Atajos (`Ctrl+Shift+/`)**: Todos los atajos agrupados por contexto, generada desde un registro único.

### 📁 Gestor SFTP y Cola de Transferencias
- **Explorador de Archivos Remoto Integrado**: Navega, crea, renombra y elimina archivos remotos directamente desde la barra lateral junto a tu terminal sin necesidad de abrir clientes externos como FileZilla.
- **Cola de Transferencias Concurrente**: Sube y descarga archivos en segundo plano con barras de progreso en tiempo real, métricas de velocidad, cancelación/pausa y reintentos automáticos.
- **Enlace Terminal a SFTP**: Haz clic en rutas de archivos detectadas en la terminal (`/var/log/nginx/error.log`) para saltar de inmediato al archivo en el explorador SFTP.

### 🌐 Túneles SSH y Jump Hosts (Bastiones)
- **Gestor Visual de Port Forwarding**: Configura y supervisa túneles Local (`-L`), Remoto (`-R`) y Dinámico SOCKS5 (`-D`) con indicadores visuales de estado activo/inactivo.
- **Encadenamiento Transparente de Bastiones**: Salta a través de múltiples servidores intermedios (`A -> B -> Destino`) usando multiplexación nativa `direct-tcpip` en Rust sin depender de binarios OpenSSH externos ni scripts complejos de `ProxyJump`.

### 🖱️ Escritorios Remotos Gráficos (RDP y VNC)
- **Pestañas y Paneles Divididos Gráficos**: Conéctate a escritorios Windows mediante **RDP** (autenticación a nivel de red NLA y cifrado TLS) y a escritorios Linux/macOS mediante **VNC** integrados en pestañas y paneles divididos junto a tus terminales.
- **Criptografía TOFU (Trust-On-First-Use)**: Comprobación de huella digital SHA-256 de certificados TLS para alertarte antes de transmitir credenciales a servidores desconocidos.
- **Controles de Escritorio**: Barra de herramientas con modo pantalla completa, captura de ratón/teclado y envío de secuencias como `Ctrl+Alt+Supr`.

### 📊 Telemetría de Servidores en Tiempo Real
- **Monitor de Recursos Sin Agentes**: Consulta periódica de `/proc/stat`, `/proc/meminfo`, `df` y `/proc/net/dev` sobre la conexión SSH activa sin instalar servicios ni agentes en el servidor remoto.
- **Barra de Telemetría Discreta**: Muestra en tiempo real la carga de CPU, uso de memoria RAM, porcentaje de disco raíz y ancho de banda de red en el borde inferior del panel activo.

### 🧰 Integración Nativa y Migración Rápida
- **Bandeja del Sistema (System Tray)**: Soporte nativo para StatusNotifierItem (KDE Plasma/Linux), bandeja de Windows y barra de menús de macOS. El modo "Cerrar a la bandeja" mantiene vivos tus túneles y transferencias SFTP en segundo plano.
- **Importador de OpenSSH en 1 Clic**: Importa automáticamente tus servidores, credenciales, alias e identidades desde `~/.ssh/config` y `~/.ssh/known_hosts`.
- **Ligera y con Carga Bajo Demanda (Lazy Loading)**: Binario de producción inferior a 20 MB gracias a optimizaciones LTO y stripping en Rust; módulos pesados (SFTP, RDP/VNC, túneles, snippets, ajustes) se cargan bajo demanda con `defineAsyncComponent` para minimizar la memoria RAM al arranque.

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
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd> | Pegar Texto del Portapapeles (con comprobación de pegado seguro) | Terminal Activa |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Space</kbd> | Quick Select (copiar elementos de la pantalla con etiquetas) | Terminal Activa |
| <kbd>Ctrl</kbd> + <kbd>Space</kbd> | Popup de Autocompletado (historial y snippets; `Tab` inserta, `Esc` cierra) | Terminal Activa |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | Paleta de Comandos de la Terminal | Espacio de Trabajo |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>V</kbd> | Historial de Pegado | Terminal Activa |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd> | Historial de Comandos por Host (`Enter` inserta, `Ctrl+Enter` ejecuta) | Terminal Activa |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> | Repetir el comando del bloque seleccionado (o del último) | Integración de Shell |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Y</kbd> | Instant Replay (revisar la salida reciente tras un `clear`) | Terminal Activa |
| <kbd>Ctrl</kbd> + <kbd>Tab</kbd> / <kbd>Ctrl</kbd> + <kbd>PageDown</kbd> | Pestaña Siguiente | Global |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Tab</kbd> / <kbd>Ctrl</kbd> + <kbd>PageUp</kbd> | Pestaña Anterior | Global |
| <kbd>Alt</kbd> + <kbd>1</kbd>..<kbd>9</kbd> | Saltar a la Pestaña 1-8 (`Alt+9` = última pestaña) | Global |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> | Nueva Terminal Local | Global |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>/</kbd> | Hoja de Atajos de Teclado | Global |
| <kbd>Escape</kbd> | Cerrar Modales y Paneles Emergentes | Global |

---

## Instalación y Distribución

NexusTerm ofrece paquetes precompilados para las principales distribuciones de Linux, Windows y macOS:

### 🐧 Linux

#### Arch Linux / Manjaro (AUR)
Instalación mediante `yay`, `paru` o desde el gestor gráfico Pamac:
```bash
yay -S nexus-term-bin
# o bien
paru -S nexus-term-bin
```

#### Flatpak Universal (Flathub)
Instalación universal para cualquier distribución con integración en KDE Discover y GNOME Software:
```bash
flatpak install flathub dev.nexusterm.app
flatpak run dev.nexusterm.app
```

#### AppImage y Paquetes Directos
Descarga directa del `.AppImage`, `.deb` (Debian/Ubuntu) o `.rpm` (Fedora/RHEL) desde [GitHub Releases](https://github.com/k4p3/Nexus-Term/releases):
```bash
chmod +x nexus-term_*_amd64.AppImage
./nexus-term_*_amd64.AppImage
```

### 🪟 Windows y 🍎 macOS
Instaladores nativos (`.msi`, `.exe`, `.dmg`) disponibles directamente en la página de [GitHub Releases](https://github.com/k4p3/Nexus-Term/releases).

---

## Entorno de Desarrollo

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
- **[Hoja de Ruta (docs/ROADMAP.md)](docs/ROADMAP.md)**: Trabajo planificado e ideas tentativas (no son compromisos).
- **[Guía de Publicación y Distribución Linux (docs/DISTRIBUTION_AND_RELEASE_GUIDE.md)](docs/DISTRIBUTION_AND_RELEASE_GUIDE.md)**: Configuración y publicación para AUR, Flathub, Snap Store y automatización en GitHub Actions.
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
