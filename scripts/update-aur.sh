#!/usr/bin/env bash
set -euo pipefail

# Script para actualizar la versión y generar .SRCINFO del paquete AUR (nexus-term-bin)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AUR_DIR="${REPO_ROOT}/packaging/aur"
PKGBUILD_FILE="${AUR_DIR}/PKGBUILD"

VERSION="${1:-}"

if [ -z "${VERSION}" ]; then
  # Leer versión desde tauri.conf.json si no se pasa como argumento
  VERSION=$(grep -oP '"version":\s*"\K[^"]+' "${REPO_ROOT}/src-tauri/tauri.conf.json" || echo "0.1.0")
fi

echo "==> Actualizando PKGBUILD a versión: ${VERSION}"

# Limpiar prefijo 'v' si viene incluido
CLEAN_VER="${VERSION#v}"

# Actualizar pkgver y reiniciar pkgrel a 1
sed -i "s/^pkgver=.*/pkgver=${CLEAN_VER}/" "${PKGBUILD_FILE}"
sed -i "s/^pkgrel=.*/pkgrel=1/" "${PKGBUILD_FILE}"

# Intentar descargar o calcular el hash SHA256 si la release remota existe
DEB_URL="https://github.com/k4p3/Nexus-Term/releases/download/v${CLEAN_VER}/nexus-term_${CLEAN_VER}_amd64.deb"
echo "==> Verificando descarga remota de: ${DEB_URL}"

if curl --output /dev/null --silent --head --fail "${DEB_URL}"; then
  echo "==> Calculando SHA256 del artefacto oficial..."
  SHA256=$(curl -sL "${DEB_URL}" | sha256sum | awk '{print $1}')
  sed -i "s/^sha256sums=.*/sha256sums=('${SHA256}')/" "${PKGBUILD_FILE}"
  echo "==> SHA256 actualizado: ${SHA256}"
else
  echo "==> AVISO: El release remoto v${CLEAN_VER} aún no existe o no es accesible. Manteniendo 'SKIP' en sha256sums."
fi

# Regenerar .SRCINFO si makepkg está instalado
if command -v makepkg >/dev/null 2>&1; then
  echo "==> Generando ${AUR_DIR}/.SRCINFO..."
  (cd "${AUR_DIR}" && makepkg --printsrcinfo > .SRCINFO)
  echo "==> .SRCINFO generado con éxito."
else
  echo "==> makepkg no disponible en este entorno; omitiendo generación de .SRCINFO."
fi

echo "==> Proceso completado correctamente."
