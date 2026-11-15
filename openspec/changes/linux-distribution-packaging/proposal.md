# Propuesta: Paquetes de Distribución Universal para Linux (AUR, Flatpak y Snap)

## 1. Resumen Ejecutivo
NexusTerm cuenta actualmente con instaladores `.AppImage`, `.deb` y `.rpm` compilados a través de GitHub Actions. Sin embargo, para integrarse de forma nativa en el ecosistema de las distribuciones Linux principales y centros de software (como **Pamac/Discover** en Manjaro KDE Plasma, **Flathub** universal y **Snap Store** en Ubuntu), se requiere incorporar los manifiestos y recetas de empaquetado canónicos:
1. **AUR (`PKGBUILD`)**: Para usuarios de Manjaro, Arch Linux, EndeavourOS y Garuda.
2. **Flatpak (`dev.nexusterm.app.yml`)**: Para distribución universal en Flathub con integración en Discover y GNOME Software.
3. **Snap (`snapcraft.yaml`)**: Para usuarios de Ubuntu y distribuciones con Snap habilitado.
4. **Metadatos XDG AppStream (`dev.nexusterm.app.metainfo.xml`)**: Ficha descriptiva, categorías, capturas y licencia para tiendas de aplicaciones.

---

## 2. Motivación y Contexto
- **Experiencia de Usuario en Manjaro/Arch**: Los usuarios de Manjaro prefieren instalar aplicaciones con `yay -S nexus-term-bin` o buscarlas directamente en Pamac, permitiendo actualizaciones automáticas junto al resto del sistema operativo.
- **Flathub como Estándar Moderno**: Flatpak es el estándar *de facto* para la entrega segura de aplicaciones de escritorio en Linux, resolviendo problemas de dependencias y aislando el runtime.
- **Visibilidad y Descubrimiento**: Sin un archivo de metadatos AppStream válido, los centros de software gráficos (como KDE Discover) no pueden mostrar el icono, descripción o capturas del gestor.

---

## 3. Alcance del Cambio

### Dentro de Alcance (In Scope)
- **Receta de AUR (`packaging/aur/`)**:
  - `PKGBUILD` para el paquete binario `nexus-term-bin`.
  - Archivo `.SRCINFO` generado.
  - Script helper `scripts/update-aur.sh` para calcular el hash SHA256 de cada release y regenerar el paquete.
- **Manifiesto Flatpak (`packaging/flatpak/`)**:
  - `dev.nexusterm.app.yml` con permisos de sandbox para SSH/red (`--share=network`), Wayland/X11 (`--socket=wayland`, `--socket=fallback-x11`), agente SSH (`--socket=ssh-auth`) y bandeja del sistema (`--talk-name=org.freedesktop.StatusNotifierWatcher`).
  - `dev.nexusterm.app.metainfo.xml` con especificación AppStream 0.16+.
- **Receta Snapcraft (`packaging/snap/`)**:
  - `snapcraft.yaml` con confinamiento estricto/clásico y plugs de red y escritorio.
- **Entrada de Escritorio e Iconos XDG**:
  - `dev.nexusterm.app.desktop` con categorías estándar `Network;System;TerminalEmulator;`.

### Fuera de Alcance (Out of Scope)
- Creación de repositorios PPA personales de Ubuntu o COPR de Fedora (ya cubiertos por `.deb`/`.rpm` de GitHub).
- Creación de cuenta de mantenedor en Flathub (el manifiesto se deja listo y validado para su envío por pull request al repositorio de Flathub).

---

## 4. Capacidades Afectadas
- **`linux-packaging` (Nueva capacidad)**: Define los contratos, permisos de sandbox, integración con el escritorio XDG y recetas de empaquetado para el sistema de distribución de Linux.

---

## 5. Cumplimiento de Licencias FOSS (GNU GPLv3)
Todos los archivos de empaquetado, recetas (`PKGBUILD`), manifiestos YAML y archivos AppStream se licencian bajo **GPL-3.0-or-later** o licencias permisivas estándar (FSFAP / CC0-1.0 para metadatos AppStream). No se incorporan dependencias binarias privativas ni incompatibles.
