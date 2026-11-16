# Guía de Publicación y Distribución en Linux (AUR, Flatpak y Snap)

Esta guía documenta los pasos necesarios para conectar los paquetes generados en GitHub Releases con los repositorios oficiales de **AUR (Arch/Manjaro)**, **Flathub (Flatpak)** y **Snap Store**, incluyendo la configuración de claves y automatización en GitHub Actions cuando decidas publicarlos.

---

## 1. Arch Linux / Manjaro (AUR - `nexus-term-bin`)

El repositorio AUR ya cuenta con los archivos base en `packaging/aur/`:
- `PKGBUILD`: Receta de instalación que descarga el `.deb` oficial de cada release.
- `.SRCINFO`: Metadatos del paquete.
- `dev.nexusterm.app.desktop`: Entrada para el menú de aplicaciones y KDE Plasma.
- `scripts/update-aur.sh`: Script helper para recalcular el hash SHA256 y actualizar la versión.

### Pasos para configurar tus claves de AUR:
1. Crea una cuenta en [https://aur.archlinux.org/register/](https://aur.archlinux.org/register/).
2. Genera un par de llaves SSH dedicadas en tu terminal:
   ```bash
   ssh-keygen -t ed25519 -C "jonn59@gmail.com" -f ~/.ssh/aur_nexus_term
   ```
3. Copia el contenido de la clave pública `~/.ssh/aur_nexus_term.pub` y pégalo en tu perfil de AUR (**My Account $\to$ SSH Public Key**).
4. Para la primera subida manual del repositorio:
   ```bash
   git clone ssh://aur@aur.archlinux.org/nexus-term-bin.git /tmp/nexus-term-bin
   cp packaging/aur/{PKGBUILD,.SRCINFO,dev.nexusterm.app.desktop} /tmp/nexus-term-bin/
   cd /tmp/nexus-term-bin
   git add .
   git commit -m "feat: initial commit for nexus-term-bin v0.1.0"
   git push origin master
   ```

### Automatización completa en GitHub Actions:
Una vez que tengas tu cuenta de AUR lista:
1. Ve a tu repositorio en GitHub: **Settings $\to$ Secrets and variables $\to$ Actions**.
2. Agrega los siguientes secretos:
   - `AUR_SSH_PRIVATE_KEY`: El contenido de tu llave privada `~/.ssh/aur_nexus_term`.
   - `AUR_USERNAME`: Tu usuario de AUR (ej. `k4p3` o `jonathan`).
3. Agrega este bloque de trabajo al final de `.github/workflows/release.yml`:
   ```yaml
     publish-aur:
       name: Publish to AUR
       needs: release
       runs-on: ubuntu-latest
       steps:
         - name: Checkout repository
           uses: actions/checkout@v4

         - name: Publish nexus-term-bin to AUR
           uses: KSXGitHub/github-actions-deploy-aur@v4
           with:
             pkgname: nexus-term-bin
             pkgbuild: ./packaging/aur/PKGBUILD
             commit_username: ${{ secrets.AUR_USERNAME }}
             commit_email: 'jonn59@gmail.com'
             ssh_private_key: ${{ secrets.AUR_SSH_PRIVATE_KEY }}
             commit_message: 'Release v${{ github.ref_name }}'
   ```

---

## 2. Flathub (Universal Flatpak)

Flathub compila los paquetes en su propia infraestructura a partir del manifiesto que creamos en `packaging/flatpak/dev.nexusterm.app.yml`.

### Pasos para publicar en Flathub:
1. Haz un fork del repositorio oficial de solicitudes de Flathub: [https://github.com/flathub/flathub](https://github.com/flathub/flathub).
2. Crea una rama con el ID de la aplicación:
   ```bash
   git checkout -b new-app-dev.nexusterm.app
   ```
3. Copia los archivos preparados:
   ```bash
   cp packaging/flatpak/dev.nexusterm.app.yml .
   cp packaging/flatpak/dev.nexusterm.app.metainfo.xml .
   ```
4. Abre un Pull Request contra `flathub/flathub`. El bot de Flathub (`flathubbot`) compilará el sandbox automáticamente y verificará los permisos.
5. Una vez aprobado y fusionado por el equipo de Flathub, se creará el repositorio oficial `https://github.com/flathub/dev.nexusterm.app`.
6. Desde ese momento, cada vez que crees un tag en NexusTerm, Flathub actualizará el paquete automáticamente y estará disponible en **KDE Discover** y **GNOME Software**.

---

## 3. Canonical Snap Store (Ubuntu)

El manifiesto está listo en `packaging/snap/snapcraft.yaml`.

### Pasos para publicar en Snap Store:
1. Instala Snapcraft en tu sistema o usa la CLI web:
   ```bash
   sudo snap install snapcraft --classic
   snapcraft login
   ```
2. Registra el nombre de la aplicación:
   ```bash
   snapcraft register nexus-term
   ```
3. Para compilar y subir manualmente:
   ```bash
   cd packaging/snap
   snapcraft --use-lxd
   snapcraft upload --release=stable nexus-term_*.snap
   ```
4. O mediante GitHub Actions conectando tu cuenta en [https://snapcraft.io/](https://snapcraft.io/) y agregando el secreto `SNAPCRAFT_STORE_CREDENTIALS` (exportado con `snapcraft export-login credentials.txt`).

---

## 4. Estado Actual de Artefactos de Empaquetado

| Canal | Ubicación en el Repositorio | Estado |
| :--- | :--- | :--- |
| **AUR (Arch/Manjaro)** | `packaging/aur/` | ✅ Receta y `.SRCINFO` generados y listos |
| **Flatpak (Flathub)** | `packaging/flatpak/` | ✅ Manifiesto y metadatos AppStream validados |
| **Snapcraft** | `packaging/snap/` | ✅ Manifiesto con extensiones GNOME/Wayland |
| **GitHub Actions** | `.github/workflows/release.yml` | ✅ Compilación automática de `.AppImage`, `.deb`, `.rpm`, `.exe`, `.msi`, `.dmg` |
