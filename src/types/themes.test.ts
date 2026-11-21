import { describe, it, expect } from 'vitest';
import {
  PRESET_THEMES,
  getThemeById,
  getUiPaletteByThemeId,
  deriveUiPalette,
  resolveUiPalette,
  contrastRatio,
} from './themes';

describe('themes utility and presets', () => {
  it('should have 9 predefined themes available', () => {
    expect(PRESET_THEMES.length).toBe(9);
    const ids = PRESET_THEMES.map((t) => t.id);
    expect(ids).toContain('nexus-slate');
    expect(ids).toContain('nexus-paper');
    expect(ids).toContain('solarized-light');
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
    expect(nonExistent.background).toBe('#0f1115'); // Nexus Slate fallback
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

  it('every preset meets AA contrast for text and on-accent text', () => {
    for (const th of PRESET_THEMES) {
      const p = getUiPaletteByThemeId(th.id);
      expect(contrastRatio(p.textMain, p.bgApp), `${th.id} text/app`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.textMain, p.bgSurface), `${th.id} text/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.textMuted, p.bgSurface), `${th.id} muted/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.onAccent, p.accent), `${th.id} onAccent`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('resolves mode by luminance and exposes every semantic token', () => {
    expect(getUiPaletteByThemeId('nexus-slate').mode).toBe('dark');
    expect(getUiPaletteByThemeId('nexus-paper').mode).toBe('light');
    expect(getUiPaletteByThemeId('solarized-light').mode).toBe('light');
    const p = resolveUiPalette(deriveUiPalette({ background: '#fafafa', foreground: '#111111' } as any));
    expect(p.mode).toBe('light');
    for (const k of ['success', 'warning', 'danger', 'info', 'overlay', 'onAccent'] as const) {
      expect(p[k]).toBeTruthy();
    }
  });
});
