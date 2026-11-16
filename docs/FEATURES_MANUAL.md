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
- **Bloques de Comandos**: cada comando es un bloque basado en *markers* de xterm, por lo que sigue apuntando a las líneas correctas cuando el *scrollback* se recorta (los bloques cuyas líneas se descartan desaparecen).
  - Indicador **✓/✗ con la duración** en el margen derecho de la línea del prompt; un clic selecciona el bloque.
  - Con un bloque seleccionado (o el último, si no hay ninguno): **copiar comando**, **copiar salida**, **repetir comando** (`Ctrl+Shift+R`, pasa por las comprobaciones del pegado seguro) y **buscar solo dentro del bloque** (`Ctrl+F`).
  - Si el shell no emite OSC 133, las acciones de bloque no aparecen y la terminal se comporta como siempre.
  - Limitación: xterm.js no permite ocultar líneas, por lo que no se pueden *colapsar* salidas (ver `docs/ROADMAP.md`).

### 4.2. Biblioteca de Snippets con Parámetros Dinámicos
- Almacena comandos recurrentes de Docker, Kubernetes, Git, bases de datos y scripts de mantenimiento.
- Parámetros dinámicos `{{parametro}}`: Al hacer clic en un snippet, NexusTerm solicita los valores variables y los inserta listos para ejecutar.

### 4.3. Modo Broadcast / Entrada Múltiple (*Multi-Exec*)
- Permite escribir en una terminal y replicar las pulsaciones en tiempo real en todos los paneles divididos activos de la pestaña. Ideal para ejecutar actualizaciones simultáneas en grupos de servidores.
- Se activa o desactiva con el botón superior en la barra de pestañas o mediante el atajo `Ctrl + Shift + B`.

### 4.4. Búsqueda Integrada en el Buffer (`Ctrl+F`)
- Barra de búsqueda interactiva con búsqueda por expresiones regulares (`RegEx`), coincidencia de palabras completas y navegación bidireccional de resultados con resaltado.

### 4.5. Enlaces Inteligentes y Detección de IPs
- Las URLs (`https://`) se abren con un clic.
- Las **rutas** (`ruta`, `ruta:línea` y `ruta:línea:columna`, p. ej. `src/main.rs:10:5`) y las **direcciones IP** (IPv4 e IPv6 válidas) se activan con `Ctrl`+clic (`Cmd`+clic en macOS); un clic normal solo selecciona texto.
  - Ruta en sesión SSH: **Copiar ruta** y **Mostrar en SFTP** (abre el panel SFTP en el directorio que la contiene).
  - Ruta en sesión local: **Copiar ruta**.
  - IP: **Conectar por SSH** (abre la Conexión Rápida con la IP rellenada) y **Copiar IP**.

### 4.6. Quick Select (`Ctrl+Shift+Space`)
- Resalta en pantalla URLs, rutas, hashes de git (7–40 hex), IPv4/IPv6, UUID, correos y números largos, y asigna una etiqueta de teclado a cada valor distinto (los más cercanos al prompt reciben las primeras letras).
- Escribe la etiqueta en **minúscula** para copiar el valor al portapapeles o en **mayúscula** para pegarlo en el prompt sin ejecutarlo. `Escape` cancela. Mientras el modo está activo, ninguna tecla llega al shell.

### 4.7. Paleta de Comandos de la Terminal (`Ctrl+Shift+P`)
- Búsqueda difusa de acciones del panel activo (buscar, dividir, saltar de prompt, Quick Select, historial de pegado…), Broadcast, Conexión Rápida, cambio de tema y snippets habilitados (con su formulario de parámetros).
- Muestra el atajo de cada acción. Las acciones de terminal no aparecen en paneles de escritorio remoto (RDP/VNC).
- `↑`/`↓` navegan, `Enter` ejecuta y `Escape` cierra.

### 4.8. Pegado Seguro e Historial de Pegado (`Ctrl+Alt+V`)
- Antes de pegar se pide confirmación, con vista previa, si el texto: tiene varias líneas (o termina en salto de línea, porque se ejecutaría al pegar), contiene comandos peligrosos (`sudo`, `rm -rf`, `dd if=`, `mkfs`, `chmod -R 777`, `curl … | sh`, *fork bomb*), incluye caracteres de control o de ancho cero (posible *paste-jacking*; se muestran como `␛`, `⟦200B⟧`…) o supera 64 KiB.
- Opciones: **Pegar**, **Pegar como una línea** o **Cancelar**. El foco inicial está en *Cancelar*.
- Los pegados simples de una línea no se interrumpen. Se puede desactivar en *Ajustes → Productividad de la terminal*.
- **Historial de pegado**: los últimos N textos pegados (20 por defecto, máximo 100) se guardan **solo en memoria**, nunca en disco, y se descartan al bloquear la bóveda o cerrar la aplicación. Las entradas con aspecto de secreto se muestran enmascaradas. Al volver a pegar una entrada se aplican las mismas comprobaciones.

### 4.9. Notificaciones de Comandos Largos
- Requiere la integración de shell (§4.1). Si un comando dura al menos el umbral configurado (10 s por defecto):
  - ventana sin foco → notificación de escritorio (✓/✗, host y duración);
  - ventana con foco pero pestaña oculta → aviso dentro de la aplicación con un botón **Ir**;
  - panel visible → sin aviso.
- Al volver a la ventana tras una notificación, se activa la pestaña y el panel que la originó.
- **Privacidad**: el texto del comando no se incluye salvo que se active en *Ajustes*. Si el sistema no permite notificaciones, se usa el aviso interno.

### 4.10. Hoja de Atajos (`Ctrl+Shift+/`)
- Lista todos los atajos agrupados por contexto. Procede de un registro único que también usan el manejador de teclado y la paleta, por lo que siempre está actualizada. Ver la tabla del §6.

---

### 4.11. Historial de Comandos por Host (`Ctrl+Shift+H`)
- Requiere la integración de shell (§4.1). Cada comando terminado se guarda **cifrado con la clave de la bóveda** (AES-256-GCM), asociado al host (o a `local` para shells locales), con su número de usos, último código de salida y fecha. Los repetidos se fusionan.
- **Nunca se registran** comandos que empiecen por espacio, vacíos, de más de 4 KiB o que parezcan contener secretos (`password`, `token`, `secret`, `api_key`, `Authorization:`, `export …KEY=`).
- `Ctrl+Shift+H` abre un selector difuso con el historial del host y tus snippets habilitados, ordenado por coincidencia, usos y recencia. `Enter` inserta el comando sin ejecutarlo; `Ctrl+Enter` lo ejecuta (si es peligroso o multilínea se pide confirmación, como en el pegado seguro).
- Al borrar un host se borra su historial. En *Ajustes → Productividad de la terminal* se puede desactivar, borrar el de un host o borrar todo. Se descarta de memoria al bloquear la bóveda.

### 4.12. Instant Replay (`Ctrl+Shift+Y`)
- Cada panel guarda su salida reciente con marca de tiempo en un **búfer circular solo en memoria**: máximo **5 minutos** y **8 MiB** por panel; al superar cualquiera de los límites se descarta lo más antiguo.
- `Ctrl+Shift+Y` abre un visor **de solo lectura** con una línea de tiempo: al mover el control se reconstruye la pantalla en ese instante, por lo que se puede ver lo que había antes de un `clear`. El visor no envía entrada a la sesión y el terminal real sigue funcionando.
- **Privacidad**: nunca se escribe en disco. Se vacía al bloquear la bóveda, al cerrar el panel y al salir de la aplicación. Se puede desactivar en *Ajustes → Productividad de la terminal* (entonces no se retiene nada).
- Limitación: la pantalla se reconstruye reproduciendo la salida desde el inicio del búfer, por lo que un programa de pantalla completa iniciado antes de esa ventana puede verse parcialmente.

### 4.13. Restauración de Sesiones
- La **distribución de pestañas y paneles divididos** (estructura, proporciones, títulos e identificadores de host) se guarda automáticamente, con un pequeño retardo tras cada cambio. **Nunca** se guardan credenciales, hostnames, contenido de la terminal ni comandos.
- Tras desbloquear la bóveda, según *Ajustes → Productividad de la terminal → Restaurar pestañas al iniciar*:
  - **Preguntar** (por defecto): un diálogo ofrece *Restaurar (N pestañas)* o *Empezar vacío*.
  - **Siempre**: se restaura sin preguntar.
  - **Nunca**: no se guarda ni se ofrece nada, y se borra el layout guardado.
- **Conexión diferida**: cada pestaña restaurada conecta solo la primera vez que se activa, para no abrir muchas conexiones a la vez.
- Los hosts que ya no existen se omiten y se avisa. Los shells locales se abren como shells nuevos (no se restaura el directorio ni el contenido). Los paneles RDP/VNC se restauran como paneles de escritorio remoto.
- Bloquear y desbloquear la bóveda durante la misma ejecución no vuelve a preguntar.

### 4.14. Compatibilidad de Terminal (Unicode, OSC 52, Imágenes y Ligaduras)
Se configuran en *Ajustes → Productividad de la terminal*.
- **Unicode 11**: los emoji y caracteres anchos (CJK) ocupan dos celdas y el cursor y el ajuste de línea los tienen en cuenta. Siempre activo.
- **Portapapeles OSC 52** (activo por defecto): un programa remoto como `tmux` o `vim` puede **copiar** al portapapeles local (hasta 1 MiB; se muestra un aviso). Es **solo escritura**: las peticiones de lectura se ignoran, por lo que un programa remoto nunca puede leer tu portapapeles.
- **Imágenes en línea** (activo por defecto): se dibujan imágenes *sixel* y *iTerm2* en la posición del cursor. La caché está limitada a 64 MB por terminal; al superarla se descartan las más antiguas.
- **Ligaduras de tipografía** (desactivadas por defecto): `=>`, `===`, `<=`… se dibujan como ligaduras.
  - **Requiere una fuente con ligaduras instalada en el sistema** (JetBrains Mono, Fira Code, Cascadia Code, Iosevka…) y que sea la primera instalada de la lista de fuentes. La ligadura la dibuja la fuente: sin ella la opción no cambia nada. Ajustes muestra un ✓ si la fuente en uso las admite, o un ⚠ con las fuentes que faltan.
  - Se necesita el renderizador *canvas* en lugar de WebGL (el renderizador DOM no sirve porque su espaciado de letras desactiva las ligaduras), por lo que puede ser algo más lento. Al desactivar la opción se vuelve a WebGL.
  - Algunas ligaduras son sutiles según la fuente (p. ej. `->` o `!=` pueden verse igual); prueba con `===`, `=>` o `<->`.

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
| `Ctrl + Shift + V` | Pegar Texto del Portapapeles (con pegado seguro) | Terminal Activa |
| `Ctrl + Shift + Space` | Quick Select (copiar/pegar con etiquetas) | Terminal Activa |
| `Ctrl + Shift + P` | Paleta de Comandos de la Terminal | Espacio de Trabajo |
| `Ctrl + Alt + V` | Historial de Pegado | Terminal Activa |
| `Ctrl + Shift + H` | Historial de Comandos por Host (`Enter` inserta, `Ctrl+Enter` ejecuta) | Terminal Activa |
| `Ctrl + Shift + R` | Repetir el comando del bloque seleccionado (o del último) | Integración de Shell |
| `Ctrl + Shift + Y` | Instant Replay (revisar la salida reciente) | Terminal Activa |
| `Ctrl + Shift + /` | Hoja de Atajos de Teclado | Global |
| `Escape` | Cerrar Modales y Paneles Flotantes | Global |
