# Tasks: Linux Distribution Packaging (AUR, Flatpak and Snap)

## 1. Arch Linux / Manjaro (AUR Packaging)

- [x] 1.1 Crear el lanzador de escritorio XDG `packaging/aur/dev.nexusterm.app.desktop` con categorías y soporte de icono nativo.
- [x] 1.2 Crear la receta `packaging/aur/PKGBUILD` para `nexus-term-bin` con dependencias del sistema, directorios de instalación (`/usr/bin`, `/usr/share/applications`, `/usr/share/icons`) y licencia GPL-3.0.
- [x] 1.3 Crear el script `scripts/update-aur.sh` para calcular automáticamente los hashes SHA256 y generar `packaging/aur/.SRCINFO`.
- [x] 1.4 Validar la sintaxis y generación de metadatos de `packaging/aur/PKGBUILD` con `namcap` o `makepkg --printsrcinfo`.

## 2. Universal Flatpak (Flathub Manifest & AppStream)

- [x] 2.1 Crear el archivo de metadatos AppStream `packaging/flatpak/dev.nexusterm.app.metainfo.xml` con descripción, categorías, URLs y notas de versión.
- [x] 2.2 Crear el manifiesto Flathub `packaging/flatpak/dev.nexusterm.app.yml` con el runtime Freedesktop 24.08 y permisos de red, agente SSH y StatusNotifierItem para KDE Plasma.
- [x] 2.3 Validar el archivo AppStream con herramientas de validación XDG (`appstreamcli validate` o linter XML).

## 3. Canonical Snapcraft (Snap Store)

- [x] 3.1 Crear el manifiesto `packaging/snap/snapcraft.yaml` con definición de plugs de red, desktop, X11, Wayland y SSH keys.

## 4. Documentación y Verificación

- [x] 4.1 Documentar en `README.md` o guía de instalación los métodos de instalación para usuarios de Manjaro/Arch (AUR) y Flatpak.
- [x] 4.2 Probar la construcción del paquete AUR localmente en Manjaro mediante `makepkg -sfc` o inspección de árbol de directorios.
