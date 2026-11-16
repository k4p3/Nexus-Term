#!/usr/bin/env bash
# Copia a site/assets/img/ los recursos que ya existen en el repositorio, para no duplicar binarios en git.
# Se usa igual en local y en el workflow de GitHub Pages.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dest="$root/site/assets/img"

# origen -> nombre en el sitio
declare -A files=(
  ["public/social-preview.png"]="social-preview.png"
  ["public/favicon.ico"]="favicon.ico"
  ["src-tauri/icons/128x128@2x.png"]="logo.png"
)

mkdir -p "$dest"
for src in "${!files[@]}"; do
  if [[ ! -f "$root/$src" ]]; then
    echo "prepare-site: falta el recurso '$src'" >&2
    exit 1
  fi
  cp "$root/$src" "$dest/${files[$src]}"
done
echo "prepare-site: recursos copiados a site/assets/img/"
