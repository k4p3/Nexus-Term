# Propuesta: Acceso Gráfico Remoto VNC y RDP

## 1. Resumen Ejecutivo
NexusTerm cubre hoy acceso en modo texto (SSH/PTY), archivos (SFTP) y túneles. Para ser una alternativa real a MobaXterm / Termius falta el **acceso a escritorios remotos gráficos**. Esta propuesta añade clientes nativos **RDP** (Windows / xrdp) y **VNC** (RFB: TigerVNC, x11vnc, macOS Screen Sharing) integrados como pestañas del mismo árbol de sesiones, con credenciales en la bóveda cifrada y posibilidad de encapsular el tráfico en un **túnel SSH** o **Jump Host** ya existentes.

## 2. Motivación y Contexto
- Los administradores alternan entre terminal SSH y escritorio gráfico (servidores Windows, VMs, equipos de laboratorio); hoy deben usar Remmina/Vinagre/RealVNC por separado, con credenciales duplicadas fuera de la bóveda.
- VNC no cifra el tráfico de forma robusta; ofrecer "VNC sobre SSH" nativo (reutilizando `direct-tcpip`) es una ventaja de seguridad clara.
- Reutiliza inventario, bóveda, jump hosts y pestañas ya implementados.

## 3. Alcance del Cambio

### Dentro de Alcance (In Scope)
- **Inventario**: campo `protocol` (`ssh` | `rdp` | `vnc`) en hosts; puertos por defecto 22/3389/5900; migración SQLite retrocompatible (hosts existentes = `ssh`).
- **Backend Rust (`src-tauri/src/remote_desktop/`)**:
  - Cliente RDP con **IronRDP** (Rust puro, NLA/CredSSP, TLS con rustls).
  - Cliente VNC con **vnc-rs** (RFB 3.8, autenticación VNC y None; codificaciones Raw/Zlib/Tight/ZRLE según soporte del crate).
  - Transporte abstracto `AsyncRead + AsyncWrite`: TCP directo, o canal `direct-tcpip` vía **SSH tunnel / Jump Host** (reutiliza el adaptador de stream de jump hosts).
  - Streaming de frames al frontend por `tauri::ipc::Channel` binario (rectángulos sucios RGBA, no JSON).
  - Entrada: teclado (scancodes), ratón, rueda, redimensionado dinámico (RDP Display Control) y portapapeles de texto bidireccional.
- **Frontend**:
  - `RemoteDesktopPane.vue` con `<canvas>` 2D que compone los rectángulos sucios; escalado "ajustar a ventana" / 100%.
  - Barra de herramientas: Ctrl+Alt+Supr, pantalla completa, calidad/escala, desconectar.
  - Selector de protocolo en `HostModal.vue`, iconos/badge por protocolo en árbol y `Ctrl+K`.
  - Store `remote-desktop.store.ts` y servicio IPC tipado.
- **Seguridad**: contraseñas RDP/VNC cifradas en bóveda (identidad tipo `password`), `zeroize`, validación/confirmación de certificado TLS del servidor RDP (TOFU con huella almacenada en bóveda).

### Fuera de Alcance (Out of Scope)
- Transferencia de archivos por redirección de unidades RDP, impresoras, audio, USB, smartcard (fase posterior).
- Portapapeles de imágenes y de archivos (solo texto en esta fase; el de archivos por RDP requiere integración nativa por plataforma y se evaluaría en un cambio posterior, p. ej. `rdp-file-clipboard`).
- Servidor RDP/VNC propio (NexusTerm solo es cliente).
- RD Gateway, Hyper-V/VMConnect, VNC con cifrado propietario (RealVNC, Apple ARD) y X11 forwarding.
- Grabación de sesión de pantalla.

## 4. Capacidades Afectadas
- **`remote-desktop` (nueva)**: conexión, render, entrada, portapapeles, ciclo de vida de sesión gráfica.
- **`host-inventory`**: campo `protocol`, validación de puertos y credenciales por protocolo.
- **`jump-hosts`**: el transporte `direct-tcpip` pasa a ser reutilizable por RDP/VNC (sin cambio normativo; se documenta en el diseño).
- **`terminal-multiplexer`**: el árbol de pestañas admite sesiones de tipo gráfico (sin *split* con terminal en esta fase).

## 5. Cumplimiento de Licencias FOSS (GNU GPLv3)
Verificado contra crates.io (2026-11-15):

| Paquete | Versión | Licencia | Compatible GPLv3 |
|---|---|---|---|
| `ironrdp` (+ `-tokio`, `-connector`, `-session`, `-cliprdr`) | 0.17 / 0.12 / 0.13 / 0.9 | MIT OR Apache-2.0 | Sí |
| `vnc-rs` | 0.6.1 | MIT OR Apache-2.0 | Sí |
| `tokio-rustls` | 0.26 | MIT OR Apache-2.0 | Sí |

Se ejecutará `cargo license` / `cargo deny check licenses` sobre el árbol transitivo antes de implementar; cualquier dependencia transitiva incompatible bloquea el cambio. No se usan noVNC, FreeRDP ni libvncclient (evita enlazado C y reduce superficie).

## 6. Riesgos
- Madurez de `vnc-rs` (menos códecs que libvncclient): mitigado con Raw/ZRLE/Tight y degradación a Raw.
- Rendimiento de canvas 2D en pantallas 4K: mitigado con rectángulos sucios y `OffscreenCanvas`/`ImageData` parcial; WebGL como mejora futura.
- Tamaño del binario (+IronRDP): se medirá y documentará en `design.md` tras el spike.
