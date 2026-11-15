# Manual de Funcionalidades de NexusTerm (`nexus-term`)

Bienvenido a la guía oficial de funcionalidades de **NexusTerm**, el gestor de conexiones SSH, SFTP y emulador de terminal moderno, de alto rendimiento y código abierto construido sobre **Tauri v2 + Rust + Vue 3 + xterm.js WebGL**.

Este documento sirve como manual vivo para desarrolladores y usuarios finales, detallando cada capacidad disponible, atajos de teclado y herramientas avanzadas.

---

## Índice

1. [Bóveda Cifrada y Seguridad Zero-Knowledge](#1-bóveda-cifrada-y-seguridad-zero-knowledge)
2. [Inventario de Servidores, Credenciales y Llaves SSH](#2-inventario-de-servidores-credenciales-y-llaves-ssh)
3. [Emulador de Terminal y Multiplexación](#3-emulador-de-terminal-y-multiplexación)
4. [Herramientas de Terminal Avanzada (Power Tools)](#4-herramientas-de-terminal-avanzada-power-tools)
5. [Personalización, Temas de Color e Internacionalización](#5-personalización-temas-de-color-e-internacionalización)
6. [Tabla de Atajos de Teclado (Cheat Sheet)](#6-tabla-de-atajos-de-teclado-cheat-sheet)

---

## 1. Bóveda Cifrada y Seguridad Zero-Knowledge

NexusTerm protege todas tus credenciales, llaves privadas y notas bajo un modelo de **conocimiento cero (Zero-Knowledge)**:

- **Derivación de Clave Maestra (Argon2id)**: La contraseña maestra nunca se guarda en disco; pasa por la función KDF con 64 MiB de memoria, 3 iteraciones y 4 hilos paralelos para máxima resistencia contra ataques de fuerza bruta por GPU.
- **Cifrado AES-256-GCM Autenticado**: Cada registro se cifra individualmente con un vector de inicialización (IV) único de 96 bits.
- **Envoltura de Llave de Bóveda (`VaultKey`)**: La clave maestra solo cifra la `VaultKey`. Esto permite cambiar la contraseña maestra al instante desde el panel de ajustes sin tener que descifrar y recifrar todos los servidores almacenados.
- **Limpieza de Memoria (`Zeroize`)**: Al bloquear la bóveda o cerrar la aplicación, las llaves en memoria de Rust se sobrescriben con ceros inmediatamente.

---

## 2. Inventario de Servidores, Credenciales y Llaves SSH

El panel lateral y la paleta de comandos permiten organizar tu infraestructura con total comodidad:

- **Estructura en Árbol y Carpetas**: Agrupa servidores por proyectos, entornos (`Producción`, `Staging`, `Laboratorio`) o clientes con colores y carpetas jerárquicas.
- **Identidades Reutilizables**: Define credenciales globales (ej. tu usuario corporativo o tu llave personal) y asígnalas a múltiples servidores con 1 clic.
- **Generador de Llaves SSH (Ed25519 & RSA)**: Genera pares de llaves seguras en la propia aplicación con un solo clic, permitiendo copiar la llave pública OpenSSH al portapapeles para añadirla fácilmente a `~/.ssh/authorized_keys`.
- **Detección Automática de Host Keys (TOFU & Known Hosts)**: Verificación criptográfica de huellas digitales SHA-256 para prevenir ataques de *Man-in-the-Middle*.
- **Barra Lateral Colapsable (`Ctrl + B` / `Cmd + B`)**: Maximiza el espacio de trabajo de la terminal ocultando o mostrando el panel izquierdo con un solo clic (desde el icono en la barra de pestañas o desde la cabecera del explorador de servidores) o mediante el atajo de teclado global.

---

## 3. Emulador de Terminal y Multiplexación

Motor de terminal de ultra-baja latencia optimizado tanto para entornos locales como para conexiones remotas:

- **Aceleración por Hardware (WebGL)**: Renderizado fluido a 60+ FPS mediante el addon WebGL con fallback automático a Canvas 2D.
- **Paneles Divididos Recursivos (*Split Panes*) & Acoplamiento de Pestañas (*Tab Docking*)**: Divide cualquier pestaña horizontal o verticalmente de forma ilimitada. Al hacer clic en el botón de división, puedes elegir abrir una **Nueva Terminal Local**, **Mismo Servidor**, **Elegir Servidor del Inventario** o **Mover una Pestaña Abierta directamente al panel dividido** sin reiniciar ni desconectar sesiones.
- **Atajos Rápidos de División y Cierre de Paneles**: Realiza divisiones instantáneas de la sesión actual sin tocar el ratón:
  - `Ctrl + Shift + O` o `Ctrl + Shift + D`: División Horizontal duplicando la sesión o host del panel activo.
  - `Ctrl + Shift + E`: División Vertical duplicando la sesión o host del panel activo.
  - `Ctrl + Shift + W`: Cerrar el panel activo enfocado.
- **Soporte Completo de Nerd Fonts & Oh My Zsh**: Compatibilidad total con fuentes tipográficas populares (`MesloLGS NF`, `Hack Nerd Font`, `JetBrains Mono NF`, `Fira Code`) e iconos Powerline/Unicode.
- **Streaming Binario Directo**: Comunicación mediante canales de streaming binario `Vec<u8>` en Tauri v2, evitando la sobrecarga de serialización JSON.

---

## 4. Herramientas de Terminal Avanzada (Power Tools)

Inspirado en emuladores modernos de última generación como **Ghostty**, **Kitty** y **Warp**:

### 4.1. Integración con el Shell (*Shell Integration — OSC 133*)
- **Detección Semántica de Prompts**: Reconoce automáticamente el inicio y fin de cada comando ejecutado en Zsh, Bash o Fish.
- **Estado de Salida y Tiempo de Ejecución**: Muestra visualmente si el comando terminó con éxito (código `0`) o error (código `1+`), junto con el tiempo exacto transcurrido (ej. `⏱ 2.1s`).
- **Navegación entre Prompts**: Atajo `Ctrl+Shift+↑` y `Ctrl+Shift+↓` para desplazarse instantáneamente al comando anterior o siguiente sin usar la rueda del ratón.
- **Copiado Inteligente**: Opciones para "Copiar solo la salida" o "Copiar el comando ejecutado".

### 4.2. Biblioteca de Snippets con Parámetros Dinámicos
- Almacena comandos recurrentes de Docker, Kubernetes, Git, bases de datos y scripts de mantenimiento.
- Parámetros dinámicos `{{parametro}}`: Al hacer clic en un snippet, NexusTerm solicita los valores variables y los inserta listos para ejecutar.

### 4.3. Modo Broadcast / Entrada Múltiple (*Multi-Exec*)
- Permite escribir en una terminal y replicar las pulsaciones en tiempo real en todos los paneles divididos activos de la pestaña. Ideal para ejecutar actualizaciones simultáneas en grupos de servidores.
- Se activa o desactiva con el botón superior en la barra de pestañas o mediante el atajo `Ctrl + Shift + B`.

### 4.4. Búsqueda Integrada en el Buffer (`Ctrl+F`)
- Barra de búsqueda interactiva con búsqueda por expresiones regulares (`RegEx`), coincidencia de palabras completas y navegación bidireccional de resultados con resaltado.

### 4.5. Enlaces Inteligentes y Detección de IPs
- Detección y clic interactivo en URLs (`https://`), rutas locales (`src/main.rs:10`) y direcciones IP (con menú contextual para conectar directamente vía SSH).

---

## 5. Personalización, Temas de Color e Internacionalización

- **Internacionalización (i18n)**: Interfaz disponible en **Inglés** y **Español** con detección automática del sistema. Posibilidad de importar archivos `.json` de traducción comunitarios.
- **Tematización Unificada de toda la Aplicación (Full-App Theming)**: Al cambiar de tema, la paleta cromática se aplica tanto al emulador de terminal `xterm.js` como a la totalidad del marco visual de NexusTerm (barra superior, barra lateral de servidores, pestañas, modales de conexión rápida y ajustes, divisores de split y cajón de snippets) mediante tokens semánticos dinámicos en CSS.
- **Paletas de Color Estándar**: Soporte para temas ANSI de 16 colores y sus contrapartes de interfaz (*Tokyo Night*, *One Dark*, *Dracula*, *Catppuccin Macchiato*, *Nord*, *KDE Breeze Dark*), así como derivación algorítmica automática para temas JSON importados de Alacritty, Tabby o Windows Terminal.
- **Aplicación en Caliente**: Los cambios de fuentes, tamaños de texto, colores y estilos de cursor se aplican en vivo sin interrumpir las sesiones en curso.

---

## 6. Tabla de Atajos de Teclado (Cheat Sheet)

| Atajo | Acción | Contexto |
| :--- | :--- | :--- |
| `Ctrl + K` / `Cmd + K` | Abrir Paleta de Conexión Rápida | Global |
| `Ctrl + B` / `Cmd + B` | Alternar Visibilidad de Barra Lateral | Global |
| `Ctrl + ,` / `Cmd + ,` | Abrir Panel de Configuración | Global |
| `Ctrl + F` / `Cmd + F` | Buscar en el Buffer de la Terminal | Terminal Activa |
| `Ctrl + Shift + O` / `Ctrl + Shift + D` | Dividir Horizontalmente (Duplica sesión actual) | Terminal Activa |
| `Ctrl + Shift + E` | Dividir Verticalmente (Duplica sesión actual) | Terminal Activa |
| `Ctrl + Shift + W` | Cerrar Panel Activo | Terminal Activa |
| `Ctrl + Shift + ↑` | Saltar al Prompt del Comando Anterior | Shell Integration |
| `Ctrl + Shift + ↓` | Saltar al Prompt del Comando Siguiente | Shell Integration |
| `Ctrl + Shift + B` | Alternar Modo Broadcast | Multiplexor |
| `Ctrl + Shift + C` | Copiar Texto Seleccionado | Terminal Activa |
| `Ctrl + Shift + V` | Pegar Texto del Portapapeles | Terminal Activa |
| `Escape` | Cerrar Modales y Paneles Flotantes | Global |
