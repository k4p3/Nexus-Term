// Addons de compatibilidad de xterm: Unicode 11, portapapeles OSC 52 (solo escritura),
// imágenes (sixel/iTerm) y ligaduras. Se cargan según las preferencias y se descartan al cambiarlas.

export const OSC52_MAX_BYTES = 1024 * 1024; // 1 MiB
/** Límite de caché de imágenes en MB (el addon descarta las más antiguas al superarlo). */
export const IMAGE_STORAGE_LIMIT_MB = 64;

export interface AddonPrefs {
  osc52_clipboard: boolean;
  inline_images: boolean;
  font_ligatures: boolean;
}

export type AddonName = "unicode11" | "clipboard" | "canvas" | "webgl" | "ligatures" | "image";

/**
 * Qué addons deben estar cargados. Las ligaduras dependen de *character joiners*: WebGL no los
 * soporta y el renderizador DOM fija un `letter-spacing` distinto de cero que hace que el navegador
 * desactive las ligaduras. Con ligaduras activas se usa por tanto el renderizador canvas.
 * El orden de las claves es el orden de carga (el renderizador antes que las ligaduras).
 */
export function planAddons(p: AddonPrefs): Record<AddonName, boolean> {
  return {
    unicode11: true,
    clipboard: p.osc52_clipboard,
    canvas: p.font_ligatures,
    webgl: !p.font_ligatures,
    ligatures: p.font_ligatures,
    image: p.inline_images,
  };
}

export interface ClipboardProviderLike {
  readText(selection: unknown): string | Promise<string>;
  writeText(selection: unknown, text: string): void | Promise<void>;
}

/**
 * Proveedor OSC 52 de solo escritura: los programas remotos pueden COPIAR al portapapeles local
 * pero nunca LEERLO (readText devuelve siempre una cadena vacía). Rechaza textos de más de 1 MiB.
 */
export function createWriteOnlyClipboardProvider(
  write: (text: string) => void | Promise<void>,
  hooks: { onCopied?: (text: string) => void; onRejected?: (bytes: number) => void } = {},
  maxBytes: number = OSC52_MAX_BYTES,
): ClipboardProviderLike {
  return {
    readText: () => "",
    async writeText(_selection, text) {
      const bytes = new TextEncoder().encode(text).length;
      if (bytes === 0) return;
      if (bytes > maxBytes) {
        hooks.onRejected?.(bytes);
        return;
      }
      try {
        await write(text);
        hooks.onCopied?.(text);
      } catch {
        /* sin permiso de portapapeles: se ignora */
      }
    },
  };
}

export interface AddonLike {
  dispose(): void;
}
export interface TermWithAddons {
  loadAddon(addon: never): void;
}

export interface AddonSpec {
  /** Crea el addon (puede lanzar si no está disponible). */
  create: () => AddonLike;
  /** Acción tras cargarlo (p. ej. activar Unicode 11). */
  onLoaded?: () => void;
  /** Acción tras descartarlo. */
  onUnloaded?: () => void;
}

/** Mantiene los addons cargados en sincronía con un plan; tolera fallos de carga de un addon. */
export class TerminalAddonManager {
  private loaded = new Map<AddonName, AddonLike>();
  private failed = new Set<AddonName>();

  constructor(
    private readonly term: TermWithAddons,
    private readonly specs: Record<AddonName, AddonSpec>,
    private readonly onWarn: (name: AddonName, err: unknown) => void = () => {},
  ) {}

  /** Aplica el plan. Devuelve los addons cuyo estado cambió. */
  apply(plan: Record<AddonName, boolean>): AddonName[] {
    const changed: AddonName[] = [];
    // Primero se descarta (p. ej. WebGL antes de cargar ligaduras) y luego se carga.
    for (const name of Object.keys(plan) as AddonName[]) {
      if (!plan[name]) {
        this.failed.delete(name);
        if (this.unload(name)) changed.push(name);
      }
    }
    for (const name of Object.keys(plan) as AddonName[]) {
      if (plan[name] && !this.loaded.has(name) && !this.failed.has(name)) {
        if (this.load(name)) changed.push(name);
      }
    }
    return changed;
  }

  isLoaded(name: AddonName): boolean {
    return this.loaded.has(name);
  }

  get(name: AddonName): AddonLike | undefined {
    return this.loaded.get(name);
  }

  dispose(): void {
    for (const name of [...this.loaded.keys()]) this.unload(name);
  }

  private load(name: AddonName): boolean {
    const spec = this.specs[name];
    let addon: AddonLike | undefined;
    try {
      addon = spec.create();
      this.term.loadAddon(addon as never);
      this.loaded.set(name, addon);
      spec.onLoaded?.();
      return true;
    } catch (err) {
      try {
        addon?.dispose();
      } catch {
        /* ya descartado */
      }
      this.failed.add(name); // no se reintenta hasta que el plan lo desactive y vuelva a activar
      this.onWarn(name, err);
      return false;
    }
  }

  private unload(name: AddonName): boolean {
    const addon = this.loaded.get(name);
    if (!addon) return false;
    this.loaded.delete(name);
    try {
      addon.dispose();
    } catch {
      /* ignorar errores de descarte */
    }
    this.specs[name].onUnloaded?.();
    return true;
  }
}
