import { describe, it, expect } from 'vitest';
import {
  PRESET_THEMES,
  getThemeById,
  getUiPaletteByThemeId,
  deriveUiPalette,
} from './themes';

describe('themes utility and presets', () => {
  it('should have 6 predefined themes available', () => {
    expect(PRESET_THEMES.length).toBe(6);
    const ids = PRESET_THEMES.map((t) => t.id);
    expect(ids).toContain('tokyo-night');
    expect(ids).toContain('dracula');
    expect(ids).toContain('nord');
    expect(ids).toContain('one-dark');
    expect(ids).toContain('catppuccin');
    expect(ids).toContain('breeze-dark');
  });

  it('should return the correct theme by id or fallback to default', () => {
    const dracula = getThemeById('dracula');
    expect(dracula.background).toBe('#282a36');

    const nonExistent = getThemeById('unknown-theme');
    expect(nonExistent.background).toBe('#1a1b26'); // Tokyo night fallback
  });

  it('should return matching UI palettes for preset themes', () => {
    const tokyoPalette = getUiPaletteByThemeId('tokyo-night');
    expect(tokyoPalette.bgApp).toBe('#1a1b26');
    expect(tokyoPalette.accent).toBe('#7aa2f7');

    const draculaPalette = getUiPaletteByThemeId('dracula');
    expect(draculaPalette.bgApp).toBe('#282a36');
    expect(draculaPalette.accent).toBe('#bd93f9');
  });

  it('should derive a cohesive UI palette for custom imported themes', () => {
    const customTheme = {
      background: '#0d1117',
      foreground: '#c9d1d9',
      blue: '#58a6ff',
      cyan: '#39c5cf',
      brightBlack: '#484f58',
    };

    const derived = deriveUiPalette(customTheme as any);
    expect(derived.bgApp).toBe('#0d1117');
    expect(derived.textMain).toBe('#c9d1d9');
    expect(derived.accent).toBe('#39c5cf');
    expect(derived.bgSurface).toMatch(/^#[0-9a-f]{6}$/i);
    expect(derived.border).toBe('#484f58');
  });
});
