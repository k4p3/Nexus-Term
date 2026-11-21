// Regla de versionado (AGENTS.md): package.json es la única fuente de verdad y todos los demás archivos deben coincidir.
// Si falla tras subir de versión, ejecuta `pnpm bump <x.y.z>` (scripts/bump-version.mjs) y añade la sección al CHANGELOG.
import { describe, it, expect } from "vitest";
import packageJson from "../../package.json?raw";
import tauriConf from "../../src-tauri/tauri.conf.json?raw";
import cargoToml from "../../src-tauri/Cargo.toml?raw";
import cargoLock from "../../src-tauri/Cargo.lock?raw";
import pkgbuild from "../../packaging/aur/PKGBUILD?raw";
import srcinfo from "../../packaging/aur/.SRCINFO?raw";
import changelog from "../../CHANGELOG.md?raw";
import { APP_VERSION } from "./app-version";

const SOURCES = import.meta.glob(["../components/**/*.vue", "../App.vue"], { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

const version = JSON.parse(packageJson).version as string;
const match = (re: RegExp, text: string) => re.exec(text)?.[1];

describe("version single source of truth", () => {
  it("package.json holds a semver version", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("the UI receives the package.json version at build time", () => {
    expect(APP_VERSION).toBe(version);
  });

  it("tauri.conf.json, Cargo.toml and Cargo.lock match", () => {
    expect(JSON.parse(tauriConf).version).toBe(version);
    expect(match(/^version\s*=\s*"([^"]+)"/m, cargoToml)).toBe(version);
    expect(match(/name = "nexus-term"\nversion = "([^"]+)"/, cargoLock)).toBe(version);
  });

  it("the AUR packaging matches", () => {
    expect(match(/^pkgver=(.+)$/m, pkgbuild)).toBe(version);
    expect(match(/^\tpkgver = (.+)$/m, srcinfo)).toBe(version);
    expect(srcinfo).toContain(`/releases/download/v${version}/nexus-term_${version}_amd64.deb`);
  });

  it("the CHANGELOG documents the current version as its latest release", () => {
    expect(match(/^## \[(\d+\.\d+\.\d+)\]/m, changelog)).toBe(version);
  });

  it("no component hard-codes a version number", () => {
    const offenders = Object.entries(SOURCES)
      .filter(([, src]) => /(?<![\w.-])v\d+\.\d+\.\d+(?![\w.-])/.test(src))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
