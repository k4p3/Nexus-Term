import { defineStore } from 'pinia';
import type { AppSettings } from '../types/settings';
import {
  PRESET_THEMES,
  type TerminalTheme,
  type ResolvedUiPalette,
  type ThemeMode,
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
  theme_id: 'nexus-slate',
  custom_themes: [],
  appearance_mode: 'manual',
  theme_light_id: 'nexus-paper',
  theme_dark_id: 'nexus-slate',
  ui_density: 'comfortable',
  default_shell: null,
  close_to_tray: true,
  ask_password_on_startup: false,
  auto_lock_enabled: true,
  auto_lock_minutes: 10,
  sftp_max_concurrent_transfers: 2,
  remote_desktop_clipboard: true,
  paste_warning: true,
  paste_history_size: 20,
  notify_long_commands: true,
  notify_threshold_seconds: 10,
  notify_include_command: false,
  history_enabled: true,
  instant_replay: true,
  restore_sessions: 'ask',
  osc52_clipboard: true,
  inline_images: true,
  font_ligatures: false,
};

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: { ...DEFAULT_SETTINGS } as AppSettings,
    customThemes: [] as TerminalTheme[],
    loaded: false,
    systemMode: 'dark' as ThemeMode,
  }),

  getters: {
    allThemes: (state): TerminalTheme[] => {
      return [...PRESET_THEMES, ...state.customThemes];
    },
    /** Theme id actually in use, honoring "follow system" mode. */
    effectiveThemeId(state): string {
      if (state.settings.appearance_mode === 'system') {
        return state.systemMode === 'light' ? state.settings.theme_light_id : state.settings.theme_dark_id;
      }
      return state.settings.theme_id;
    },
    activeTheme(): ITheme {
      const found = this.allThemes.find((t) => t.id === this.effectiveThemeId);
      return found ? found.theme : PRESET_THEMES[0].theme;
    },
    activeUiPalette(): ResolvedUiPalette {
      return getUiPaletteByThemeId(this.effectiveThemeId, this.customThemes);
    },
  },

  actions: {
    applyThemeToDom(themeId?: string) {
      const tid = themeId || this.effectiveThemeId;
      const palette = getUiPaletteByThemeId(tid, this.customThemes);
      const root = document.documentElement;
      const vars: Record<string, string> = {
        '--theme-bg-app': palette.bgApp,
        '--theme-bg-surface': palette.bgSurface,
        '--theme-bg-header': palette.bgHeader,
        '--theme-bg-active': palette.bgActive,
        '--theme-border': palette.border,
        '--theme-text-main': palette.textMain,
        '--theme-text-muted': palette.textMuted,
        '--theme-accent': palette.accent,
        '--theme-accent-hover': palette.accentHover,
        '--theme-on-accent': palette.onAccent,
        '--theme-success': palette.success,
        '--theme-warning': palette.warning,
        '--theme-danger': palette.danger,
        '--theme-info': palette.info,
        '--theme-overlay': palette.overlay,
      };
      for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
      root.style.colorScheme = palette.mode;
      root.dataset.themeMode = palette.mode;
      root.dataset.density = this.settings.ui_density;
    },

    /** Subscribes to prefers-color-scheme; returns an unsubscribe function. */
    watchSystemMode(): () => void {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const sync = () => {
        this.systemMode = mq.matches ? 'light' : 'dark';
        if (this.settings.appearance_mode === 'system') this.applyThemeToDom();
      };
      sync();
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    },

    hydrateCustomThemes() {
      this.customThemes = (this.settings.custom_themes || []).map((c) => ({
        id: c.id,
        name: c.name,
        theme: c.theme as ITheme,
        ui: c.ui ? (c.ui as unknown as TerminalTheme['ui']) : deriveUiPalette(c.theme as ITheme),
      }));
    },

    async loadSettings() {
      try {
        const loaded = await settingsService.getSettings();
        this.settings = { ...DEFAULT_SETTINGS, ...loaded };
        this.hydrateCustomThemes();
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
      if (
        partial.theme_id ||
        partial.appearance_mode ||
        partial.theme_light_id ||
        partial.theme_dark_id ||
        partial.ui_density
      ) {
        this.applyThemeToDom();
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
        this.settings = { ...DEFAULT_SETTINGS, ...defaults };
        this.hydrateCustomThemes();
        setAppLocale(defaults.locale);
        this.applyThemeToDom();
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
      const records = [...(this.settings.custom_themes || []), { id, name, theme: theme as Record<string, string>, ui: ui as unknown as Record<string, string> }];
      this.updateSettings({ theme_id: id, appearance_mode: 'manual', custom_themes: records });
      return id;
    },

    removeCustomTheme(id: string) {
      this.customThemes = this.customThemes.filter((t) => t.id !== id);
      const patch: Partial<AppSettings> = {
        custom_themes: (this.settings.custom_themes || []).filter((c) => c.id !== id),
      };
      if (this.settings.theme_id === id) patch.theme_id = DEFAULT_SETTINGS.theme_id;
      if (this.settings.theme_light_id === id) patch.theme_light_id = DEFAULT_SETTINGS.theme_light_id;
      if (this.settings.theme_dark_id === id) patch.theme_dark_id = DEFAULT_SETTINGS.theme_dark_id;
      return this.updateSettings(patch);
    },

    importCustomLocale(code: string, jsonContent: string) {
      const parsed = JSON.parse(jsonContent);
      registerCustomLocale(code, parsed);
      this.updateSettings({ locale: code });
    },
  },
});
