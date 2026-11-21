/** Registro único de atajos de teclado: lo consumen el manejador de teclas, la paleta y la hoja de atajos. */
export type ShortcutContext = "global" | "terminal" | "workspace";
export type ShortcutGroup = "navigation" | "panes" | "selection" | "clipboard" | "tools";

export interface KeyCombo {
  /** Valor de `KeyboardEvent.key` en minúsculas (se usa si no hay `code`). */
  key?: string;
  /** Valor de `KeyboardEvent.code` (para teclas dependientes de distribución, p. ej. `Slash`, `Space`). */
  code?: string;
  /** Ctrl en Linux/Windows, Cmd en macOS (como hasta ahora). */
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface ShortcutDef {
  id: string;
  combo: KeyCombo;
  context: ShortcutContext;
  titleKey: string;
  group: ShortcutGroup;
  /** Atajo resuelto por el navegador/xterm (copiar/pegar): se documenta pero no se intercepta. */
  native?: boolean;
}

const def = (
  id: string,
  combo: KeyCombo,
  context: ShortcutContext,
  group: ShortcutGroup,
  native = false,
): ShortcutDef => ({ id, combo, context, group, titleKey: `shortcuts.${id}`, native });

export const SHORTCUTS: ShortcutDef[] = [
  def("app.quickConnect", { key: "k", ctrl: true }, "global", "navigation"),
  def("app.toggleSidebar", { key: "b", ctrl: true }, "global", "navigation"),
  def("app.settings", { key: ",", ctrl: true }, "global", "navigation"),
  def("app.nextTab", { code: "Tab", ctrl: true }, "global", "navigation"),
  def("app.nextTabAlt", { code: "PageDown", ctrl: true }, "global", "navigation"),
  def("app.prevTab", { code: "Tab", ctrl: true, shift: true }, "global", "navigation"),
  def("app.prevTabAlt", { code: "PageUp", ctrl: true }, "global", "navigation"),
  def("terminal.newLocal", { key: "t", ctrl: true, shift: true }, "global", "navigation"),
  def("app.shortcuts", { code: "Slash", ctrl: true, shift: true }, "global", "tools"),
  def("terminal.search", { key: "f", ctrl: true }, "terminal", "tools"),
  def("terminal.splitH", { key: "o", ctrl: true, shift: true }, "terminal", "panes"),
  def("terminal.splitHAlt", { key: "d", ctrl: true, shift: true }, "terminal", "panes"),
  def("terminal.splitV", { key: "e", ctrl: true, shift: true }, "terminal", "panes"),
  def("terminal.closePane", { key: "w", ctrl: true, shift: true }, "terminal", "panes"),
  def("terminal.focusLeft", { key: "arrowleft", alt: true }, "terminal", "panes"),
  def("terminal.focusRight", { key: "arrowright", alt: true }, "terminal", "panes"),
  def("terminal.focusUp", { key: "arrowup", alt: true }, "terminal", "panes"),
  def("terminal.focusDown", { key: "arrowdown", alt: true }, "terminal", "panes"),
  def("workspace.broadcast", { key: "b", ctrl: true, shift: true }, "workspace", "panes"),
  def("terminal.prevPrompt", { key: "arrowup", ctrl: true, shift: true }, "terminal", "navigation"),
  def("terminal.nextPrompt", { key: "arrowdown", ctrl: true, shift: true }, "terminal", "navigation"),
  def("terminal.copy", { key: "c", ctrl: true, shift: true }, "terminal", "clipboard", true),
  def("terminal.paste", { key: "v", ctrl: true, shift: true }, "terminal", "clipboard", true),
  def("terminal.quickSelect", { code: "Space", ctrl: true, shift: true }, "terminal", "selection"),
  def("terminal.palette", { key: "p", ctrl: true, shift: true }, "workspace", "tools"),
  def("terminal.pasteHistory", { key: "v", ctrl: true, alt: true }, "terminal", "clipboard"),
  def("terminal.history", { key: "h", ctrl: true, shift: true }, "terminal", "tools"),
  def("terminal.rerunBlock", { key: "r", ctrl: true, shift: true }, "terminal", "tools"),
  def("terminal.instantReplay", { key: "y", ctrl: true, shift: true }, "terminal", "tools"),
];

type KeyLike = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

export function comboMatches(combo: KeyCombo, e: KeyLike): boolean {
  if (!!combo.ctrl !== (e.ctrlKey || e.metaKey)) return false;
  if (!!combo.shift !== e.shiftKey) return false;
  if (!!combo.alt !== e.altKey) return false;
  if (combo.code) return e.code === combo.code;
  return !!combo.key && e.key.toLowerCase() === combo.key;
}

function contextApplies(def: ShortcutDef, active: ShortcutContext[]): boolean {
  return def.context === "global" || active.includes(def.context);
}

/** Devuelve el atajo del registro que coincide con la tecla en los contextos activos (ignora los nativos). */
export function matchShortcut(
  e: KeyLike,
  active: ShortcutContext[] = ["global", "terminal", "workspace"],
  defs: ShortcutDef[] = SHORTCUTS,
): ShortcutDef | null {
  return defs.find((d) => !d.native && contextApplies(d, active) && comboMatches(d.combo, e)) ?? null;
}

const comboId = (c: KeyCombo) => `${c.ctrl ? "C" : ""}${c.shift ? "S" : ""}${c.alt ? "A" : ""}+${c.code ?? c.key}`;
const overlaps = (a: ShortcutContext, b: ShortcutContext) => a === "global" || b === "global" || a === b;

/** Pares de atajos con la misma combinación en contextos solapados. */
export function findConflicts(defs: ShortcutDef[] = SHORTCUTS): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < defs.length; i++) {
    for (let j = i + 1; j < defs.length; j++) {
      if (comboId(defs[i].combo) === comboId(defs[j].combo) && overlaps(defs[i].context, defs[j].context)) {
        out.push([defs[i].id, defs[j].id]);
      }
    }
  }
  return out;
}

const KEY_LABELS: Record<string, string> = {
  arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→",
};
const CODE_LABELS: Record<string, string> = { Slash: "/", Space: "Space" };

export function formatShortcut(d: ShortcutDef, platform: "mac" | "other" = "other"): string {
  const c = d.combo;
  const keyName = c.code
    ? (CODE_LABELS[c.code] ?? c.code)
    : (KEY_LABELS[c.key ?? ""] ?? (c.key ?? "").toUpperCase());
  if (platform === "mac") {
    return `${c.ctrl ? "⌘" : ""}${c.shift ? "⇧" : ""}${c.alt ? "⌥" : ""}${keyName}`;
  }
  return [c.ctrl && "Ctrl", c.shift && "Shift", c.alt && "Alt", keyName].filter(Boolean).join("+");
}

export function currentPlatform(): "mac" | "other" {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "mac" : "other";
}
