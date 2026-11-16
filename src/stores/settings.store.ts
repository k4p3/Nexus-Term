import { defineStore } from 'pinia';
import type { AppSettings } from '../types/settings';
import {
  PRESET_THEMES,
  type TerminalTheme,
  type UiThemePalette,
  getUiPaletteByThemeId,
  deriveUiPalette,
} from '../types/themes';
import type { ITheme } from '@xterm/xterm';
import { settingsService } from '../services/settings.service';
import { setAppLocale, registerCustomLocale } from '../locales';

const DEFAULT_SETTINGS: AppSettings = {
  locale: 'en',
  font_family: "'MesloLGS NF', 'Hack Nerd Font Mono', 'Hack Nerd Font', 'FiraCode Nerd Font', 'JetBrainsMono Nerd Font', monospace",
  font_size: 13,
  line_height: 1.2,
  cursor_style: 'block',
  cursor_blink: true,
  theme_id: 'tokyo-night',
  default_shell: null,
  close_to_tray: true,
  auto_lock_minutes: 0,
  sftp_max_concurrent_transfers: 2,
  remote_desktop_clipboard: true,
  paste_warning: true,
  paste_history_size: 20,
  notify_long_commands: true,
  notify_threshold_seconds: 10,
  notify_include_command: false,
};

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: { ...DEFAULT_SETTINGS } as AppSettings,
    customThemes: [] as TerminalTheme[],
    loaded: false,
  }),

  getters: {
    allThemes: (state): TerminalTheme[] => {
      return [...PRESET_THEMES, ...state.customThemes];
    },
    activeTheme(): ITheme {
      const found = this.allThemes.find((t) => t.id === this.settings.theme_id);
      return found ? found.theme : PRESET_THEMES[0].theme;
    },
    activeUiPalette(): UiThemePalette {
      return getUiPaletteByThemeId(this.settings.theme_id, this.customThemes);
    },
  },

  actions: {
    applyThemeToDom(themeId?: string) {
      const tid = themeId || this.settings.theme_id;
      const palette = getUiPaletteByThemeId(tid, this.customThemes);
      const root = document.documentElement;
      root.style.setProperty('--theme-bg-app', palette.bgApp);
      root.style.setProperty('--theme-bg-surface', palette.bgSurface);
      root.style.setProperty('--theme-bg-header', palette.bgHeader);
      root.style.setProperty('--theme-bg-active', palette.bgActive);
      root.style.setProperty('--theme-border', palette.border);
      root.style.setProperty('--theme-text-main', palette.textMain);
      root.style.setProperty('--theme-text-muted', palette.textMuted);
      root.style.setProperty('--theme-accent', palette.accent);
      root.style.setProperty('--theme-accent-hover', palette.accentHover);
    },

    async loadSettings() {
      try {
        const loaded = await settingsService.getSettings();
        this.settings = { ...DEFAULT_SETTINGS, ...loaded };
        setAppLocale(this.settings.locale);
        this.applyThemeToDom();
      } catch (err) {
        console.warn('Failed to load settings, using defaults:', err);
        this.applyThemeToDom();
      } finally {
        this.loaded = true;
      }
    },

    async updateSettings(partial: Partial<AppSettings>) {
      this.settings = { ...this.settings, ...partial };
      if (partial.locale) {
        setAppLocale(partial.locale);
      }
      if (partial.theme_id) {
        this.applyThemeToDom(partial.theme_id);
      }
      try {
        await settingsService.saveSettings(this.settings);
      } catch (err) {
        console.error('Failed to save settings:', err);
        throw err;
      }
    },

    async resetSettings() {
      try {
        const defaults = await settingsService.resetSettings();
        this.settings = defaults;
        setAppLocale(defaults.locale);
        this.applyThemeToDom(defaults.theme_id);
      } catch (err) {
        console.error('Failed to reset settings:', err);
        this.settings = { ...DEFAULT_SETTINGS };
        setAppLocale(DEFAULT_SETTINGS.locale);
        this.applyThemeToDom(DEFAULT_SETTINGS.theme_id);
      }
    },

    importCustomTheme(name: string, theme: ITheme): string {
      const id = 'custom-' + Date.now();
      const ui = deriveUiPalette(theme);
      this.customThemes.push({ id, name, theme, ui });
      this.updateSettings({ theme_id: id });
      return id;
    },

    importCustomLocale(code: string, jsonContent: string) {
      const parsed = JSON.parse(jsonContent);
      registerCustomLocale(code, parsed);
      this.updateSettings({ locale: code });
    },
  },
});
