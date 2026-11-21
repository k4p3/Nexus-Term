#!/usr/bin/env node
// Uso: node scripts/bump-version.mjs <x.y.z>
// Actualiza TODOS los archivos que llevan la versión (ver AGENTS.md, "Versionado").
// La interfaz toma la versión de package.json en tiempo de compilación, así que no hay nada más que editar.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Uso: node scripts/bump-version.mjs <x.y.z>");
  process.exit(1);
}

const edits = [
  ["package.json", /("version":\s*")[^"]+(")/, `$1${version}$2`],
  ["src-tauri/tauri.conf.json", /("version":\s*")[^"]+(")/, `$1${version}$2`],
  ["src-tauri/Cargo.toml", /^(version\s*=\s*")[^"]+(")/m, `$1${version}$2`],
  ["src-tauri/Cargo.lock", /(name = "nexus-term"\nversion = ")[^"]+(")/, `$1${version}$2`],
  ["packaging/aur/PKGBUILD", /^(pkgver=).+$/m, `$1${version}`],
  ["packaging/aur/PKGBUILD", /^(pkgrel=).+$/m, `$11`],
  ["packaging/aur/.SRCINFO", /^(\tpkgver = ).+$/m, `$1${version}`],
  ["packaging/aur/.SRCINFO", /^(\tpkgrel = ).+$/m, `$11`],
  ["packaging/aur/.SRCINFO", /(\tsource = .*\/releases\/download\/v)[^/]+(\/nexus-term_)[^_]+(_amd64\.deb)/, `$1${version}$2${version}$3`],
];

for (const [file, re, replacement] of edits) {
  const path = resolve(root, file);
  const before = readFileSync(path, "utf-8");
  if (!re.test(before)) {
    console.error(`No se encontró la versión en ${file}`);
    process.exit(1);
  }
  writeFileSync(path, before.replace(re, replacement));
  console.log(`✓ ${file} → ${version}`);
}
console.log("\nRecuerda: añadir la sección [" + version + "] al CHANGELOG.md y revisar los sources/sha del AUR.");
