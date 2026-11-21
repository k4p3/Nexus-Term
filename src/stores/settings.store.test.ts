import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("../services/settings.service", () => ({
  settingsService: {
    getSettings: vi.fn(),
    saveSettings: vi.fn(async (s: unknown) => s),
    resetSettings: vi.fn(),
  },
}));
vi.mock("../locales", () => ({ setAppLocale: vi.fn(), registerCustomLocale: vi.fn() }));

import { useSettingsStore } from "./settings.store";
import { settingsService } from "../services/settings.service";

const rootVar = (n: string) => document.documentElement.style.getPropertyValue(n);

describe("settings store theming", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    document.documentElement.removeAttribute("style");
  });

  it("applies every token and color-scheme to the DOM", () => {
    const s = useSettingsStore();
    s.applyThemeToDom("nexus-paper");
    expect(rootVar("--theme-bg-app")).toBe("#f6f7f9");
    expect(rootVar("--theme-on-accent")).toBeTruthy();
    expect(rootVar("--theme-danger")).toBeTruthy();
    expect(rootVar("--theme-overlay")).toContain("rgba");
    expect(document.documentElement.style.colorScheme).toBe("light");
    s.applyThemeToDom("nexus-slate");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("re-applies the theme when settings change", async () => {
    const s = useSettingsStore();
    await s.updateSettings({ theme_id: "nexus-paper" });
    expect(rootVar("--theme-bg-app")).toBe("#f6f7f9");
    await s.updateSettings({ ui_density: "compact" });
    expect(document.documentElement.dataset.density).toBe("compact");
  });

  it("follows the system mode using the light/dark themes", async () => {
    const s = useSettingsStore();
    await s.updateSettings({ appearance_mode: "system", theme_light_id: "nexus-paper", theme_dark_id: "dracula" });
    s.systemMode = "light";
    expect(s.effectiveThemeId).toBe("nexus-paper");
    s.systemMode = "dark";
    expect(s.effectiveThemeId).toBe("dracula");
    expect(s.activeTheme.background).toBe("#282a36");
  });

  it("persists imported custom themes and restores them on load", async () => {
    const s = useSettingsStore();
    const id = s.importCustomTheme("Mine", { background: "#101010", foreground: "#eeeeee" });
    expect(s.settings.custom_themes.map((c) => c.id)).toContain(id);
    expect(settingsService.saveSettings).toHaveBeenCalled();

    const saved = s.settings;
    setActivePinia(createPinia());
    vi.mocked(settingsService.getSettings).mockResolvedValue(saved);
    const fresh = useSettingsStore();
    await fresh.loadSettings();
    expect(fresh.customThemes.find((t) => t.id === id)?.name).toBe("Mine");
    expect(fresh.effectiveThemeId).toBe(id);
    expect(rootVar("--theme-bg-app")).toBe("#101010");
  });

  it("removes a custom theme and falls back to the default", async () => {
    const s = useSettingsStore();
    const id = s.importCustomTheme("Mine", { background: "#101010", foreground: "#eeeeee" });
    await s.removeCustomTheme(id);
    expect(s.customThemes).toEqual([]);
    expect(s.settings.theme_id).toBe("nexus-slate");
  });
});
