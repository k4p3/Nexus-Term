import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '../types/settings';

export const settingsService = {
  async getSettings(): Promise<AppSettings> {
    return await invoke<AppSettings>('get_app_settings');
  },

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    return await invoke<AppSettings>('save_app_settings', { settings });
  },

  async resetSettings(): Promise<AppSettings> {
    return await invoke<AppSettings>('reset_app_settings');
  },
};
