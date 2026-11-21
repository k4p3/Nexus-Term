// Garantiza que las traducciones estén completas y que toda clave usada en la interfaz exista.
import { describe, it, expect } from "vitest";
import en from "./en.json";
import es from "./es.json";

const SOURCES = import.meta.glob(["../components/**/*.vue", "../App.vue", "../composables/**/*.ts", "../stores/**/*.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}
function lookup(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

describe("locales", () => {
  const enKeys = flatten(en);
  const esKeys = flatten(es);

  it("English and Spanish define exactly the same keys", () => {
    expect(enKeys.filter((k) => !esKeys.includes(k))).toEqual([]);
    expect(esKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
  });

  it("has no empty translations", () => {
    expect(enKeys.filter((k) => lookup(en, k) === "")).toEqual([]);
    expect(esKeys.filter((k) => lookup(es, k) === "")).toEqual([]);
  });

  it("every literal t('key') used in the UI exists in the translations", () => {
    const missing = new Set<string>();
    for (const [file, src] of Object.entries(SOURCES)) {
      for (const m of src.matchAll(/(?<![\w.])t\(\s*['"]([\w.-]+)['"]/g)) {
        if (typeof lookup(en, m[1]) !== "string") missing.add(`${file}: ${m[1]}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
