import { describe, it, expect } from "vitest";
import readmeEn from "../../README.md?raw";
import readmeEs from "../../README.es.md?raw";
import manual from "../../docs/FEATURES_MANUAL.md?raw";
import { SHORTCUTS, formatShortcut } from "./shortcuts";

/** Quita el marcado (`<kbd>`, comillas invertidas) y los espacios: `<kbd>Ctrl</kbd> + <kbd>K</kbd>` → `Ctrl+K`. */
const normalize = (s: string) => s.replace(/<\/?kbd>/g, "").replace(/`/g, "").replace(/\s+/g, "");

// Atajos alternativos que comparten fila con otro en la documentación.
const DOCUMENTED_AS: Record<string, string[]> = {
  "terminal.splitHAlt": ["Ctrl+Shift+O/D", "Ctrl+Shift+O/Ctrl+Shift+D"],
};

describe("documentation lists every registered shortcut", () => {
  const docs: [string, string][] = [
    ["README.md", normalize(readmeEn)],
    ["README.es.md", normalize(readmeEs)],
    ["docs/FEATURES_MANUAL.md", normalize(manual)],
  ];

  for (const def of SHORTCUTS) {
    const accepted = DOCUMENTED_AS[def.id] ?? [formatShortcut(def, "other")];
    for (const [name, text] of docs) {
      it(`${def.id} (${accepted[0]}) appears in ${name}`, () => {
        expect(accepted.some((a) => text.includes(a))).toBe(true);
      });
    }
  }
});
