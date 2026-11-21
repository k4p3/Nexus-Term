import type { ITheme } from '@xterm/xterm';

export interface UiThemePalette {
  bgApp: string;        // Main window / terminal background wrapper
  bgSurface: string;    // Sidebar, modal container, card surface
  bgHeader: string;     // Titlebar / top bar and tab bar idle background
  bgActive: string;     // Active tab, hover row, button active
  border: string;       // Panel borders, dividers, card borders
  textMain: string;     // Primary high-contrast text
  textMuted: string;    // Secondary/muted descriptions, labels
  accent: string;       // Primary brand/theme accent
  accentHover: string;  // Hover state for accent buttons
}

export type ThemeMode = 'dark' | 'light';

/** Palette with every token the UI consumes (semantic colors, mode, on-accent). */
export interface ResolvedUiPalette extends UiThemePalette {
  mode: ThemeMode;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  overlay: string;
}

export interface TerminalTheme {
  id: string;
  name: string;
  theme: ITheme;
  ui?: UiThemePalette;
}

export const PRESET_THEMES: TerminalTheme[] = [
  {
    id: 'nexus-slate',
    name: 'Nexus Slate',
    theme: {
      foreground: '#e6e9ef',
      background: '#0f1115',
      cursor: '#6b8cff',
      cursorAccent: '#0f1115',
      selectionBackground: '#2b3550',
      selectionForeground: '#e6e9ef',
      black: '#1d222a',
      red: '#f27d84',
      green: '#5fd38d',
      yellow: '#e5b567',
      blue: '#6b8cff',
      magenta: '#b393f5',
      cyan: '#5cc8d6',
      white: '#c4cad6',
      brightBlack: '#5b6474',
      brightRed: '#ff9aa0',
      brightGreen: '#7fe3a6',
      brightYellow: '#f2c985',
      brightBlue: '#8aa5ff',
      brightMagenta: '#c9b0ff',
      brightCyan: '#7edce8',
      brightWhite: '#f4f6fa',
    },
    ui: {
      bgApp: '#0f1115',
      bgSurface: '#161a20',
      bgHeader: '#1d222a',
      bgActive: '#262d38',
      border: '#2a303a',
      textMain: '#e6e9ef',
      textMuted: '#8b94a3',
      accent: '#6b8cff',
      accentHover: '#8aa5ff',
    },
  },
  {
    id: 'nexus-paper',
    name: 'Nexus Paper',
    theme: {
      foreground: '#1b1f27',
      background: '#ffffff',
      cursor: '#3f5fe0',
      cursorAccent: '#ffffff',
      selectionBackground: '#cfd9fb',
      selectionForeground: '#1b1f27',
      black: '#1b1f27',
      red: '#c62828',
      green: '#1a7f4b',
      yellow: '#9a6700',
      blue: '#3f5fe0',
      magenta: '#8a3fc4',
      cyan: '#0e7490',
      white: '#6b7280',
      brightBlack: '#4b5563',
      brightRed: '#d94646',
      brightGreen: '#23995c',
      brightYellow: '#b57d12',
      brightBlue: '#5775ee',
      brightMagenta: '#a15ad8',
      brightCyan: '#1590ae',
      brightWhite: '#9aa1ad',
    },
    ui: {
      bgApp: '#f6f7f9',
      bgSurface: '#ffffff',
      bgHeader: '#eceef2',
      bgActive: '#e1e5ec',
      border: '#d9dde4',
      textMain: '#1b1f27',
      textMuted: '#5b6472',
      accent: '#3f5fe0',
      accentHover: '#2f4ac0',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    theme: {
      foreground: '#586e75',
      background: '#fdf6e3',
      cursor: '#586e75',
      cursorAccent: '#fdf6e3',
      selectionBackground: '#eee8d5',
      selectionForeground: '#073642',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#93a1a1',
      brightBlack: '#657b83',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#586e75',
    },
    ui: {
      bgApp: '#fdf6e3',
      bgSurface: '#fffbee',
      bgHeader: '#eee8d5',
      bgActive: '#e6dfc8',
      border: '#d8d1ba',
      textMain: '#3d5058',
      textMuted: '#657b83',
      accent: '#1f6fa8',
      accentHover: '#175a8a',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    theme: {
      foreground: '#a9b1d6',
      background: '#1a1b26',
      cursor: '#c0caf5',
      cursorAccent: '#1a1b26',
      selectionBackground: '#33467c',
      selectionForeground: '#c0caf5',
      black: '#32344a',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#ad8ee6',
      cyan: '#449dab',
      white: '#787c99',
      brightBlack: '#444b6a',
      brightRed: '#ff7a93',
      brightGreen: '#b9f27c',
      brightYellow: '#ff9e64',
      brightBlue: '#7da6ff',
      brightMagenta: '#bb9af7',
      brightCyan: '#0db9d7',
      brightWhite: '#acb0d0',
    },
    ui: {
      bgApp: '#1a1b26',
      bgSurface: '#16161e',
      bgHeader: '#13141c',
      bgActive: '#24283b',
      border: '#292e42',
      textMain: '#c0caf5',
      textMuted: '#787c99',
      accent: '#7aa2f7',
      accentHover: '#89b4fa',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    theme: {
      foreground: '#abb2bf',
      background: '#1e1e1e',
      cursor: '#528bff',
      cursorAccent: '#1e1e1e',
      selectionBackground: '#3e4451',
      selectionForeground: '#abb2bf',
      black: '#282c34',
      red: '#e06c75',
      green: '#98c379',
      yellow: '#e5c07b',
      blue: '#61afef',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#abb2bf',
      brightBlack: '#5c6370',
      brightRed: '#be5046',
      brightGreen: '#98c379',
      brightYellow: '#e5c07b',
      brightBlue: '#61afef',
      brightMagenta: '#c678dd',
      brightCyan: '#56b6c2',
      brightWhite: '#ffffff',
    },
    ui: {
      bgApp: '#1e1e1e',
      bgSurface: '#21252b',
      bgHeader: '#181a1f',
      bgActive: '#2c313a',
      border: '#3b4048',
      textMain: '#abb2bf',
      textMuted: '#5c6370',
      accent: '#61afef',
      accentHover: '#528bff',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    theme: {
      foreground: '#f8f8f2',
      background: '#282a36',
      cursor: '#f8f8f2',
      cursorAccent: '#282a36',
      selectionBackground: '#44475a',
      selectionForeground: '#f8f8f2',
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff',
    },
    ui: {
      bgApp: '#282a36',
      bgSurface: '#21222c',
      bgHeader: '#191a21',
      bgActive: '#343746',
      border: '#44475a',
      textMain: '#f8f8f2',
      textMuted: '#6272a4',
      accent: '#bd93f9',
      accentHover: '#ff79c6',
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin Macchiato',
    theme: {
      foreground: '#cad3f5',
      background: '#24273a',
      cursor: '#f4dbd6',
      cursorAccent: '#24273a',
      selectionBackground: '#5b6078',
      selectionForeground: '#cad3f5',
      black: '#494d64',
      red: '#ed8796',
      green: '#a6da95',
      yellow: '#eed49f',
      blue: '#8aadf4',
      magenta: '#f5bde6',
      cyan: '#8bd5ca',
      white: '#b8c0e0',
      brightBlack: '#5b6078',
      brightRed: '#ed8796',
      brightGreen: '#a6da95',
      brightYellow: '#eed49f',
      brightBlue: '#8aadf4',
      brightMagenta: '#f5bde6',
      brightCyan: '#8bd5ca',
      brightWhite: '#a5adcb',
    },
    ui: {
      bgApp: '#24273a',
      bgSurface: '#1e2030',
      bgHeader: '#181926',
      bgActive: '#363a4f',
      border: '#494d64',
      textMain: '#cad3f5',
      textMuted: '#8087a2',
      accent: '#8aadf4',
      accentHover: '#8bd5ca',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    theme: {
      foreground: '#d8dee9',
      background: '#2e3440',
      cursor: '#d8dee9',
      cursorAccent: '#2e3440',
      selectionBackground: '#434c5e',
      selectionForeground: '#d8dee9',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#bf616a',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4',
    },
    ui: {
      bgApp: '#2e3440',
      bgSurface: '#242933',
      bgHeader: '#1e222a',
      bgActive: '#3b4252',
      border: '#434c5e',
      textMain: '#eceff4',
      textMuted: '#7b88a1',
      accent: '#88c0d0',
      accentHover: '#81a1c1',
    },
  },
  {
    id: 'breeze-dark',
    name: 'KDE Breeze Dark',
    theme: {
      foreground: '#fcfcfc',
      background: '#232629',
      cursor: '#fcfcfc',
      cursorAccent: '#232629',
      selectionBackground: '#3daee9',
      selectionForeground: '#fcfcfc',
      black: '#232629',
      red: '#ed1515',
      green: '#11d116',
      yellow: '#f67400',
      blue: '#1d99f3',
      magenta: '#9b59b6',
      cyan: '#1abc9c',
      white: '#fcfcfc',
      brightBlack: '#7f8c8d',
      brightRed: '#c0392b',
      brightGreen: '#27ae60',
      brightYellow: '#f39c1f',
      brightBlue: '#2980b9',
      brightMagenta: '#8e44ad',
      brightCyan: '#16a085',
      brightWhite: '#ffffff',
    },
    ui: {
      bgApp: '#232629',
      bgSurface: '#1b1e20',
      bgHeader: '#16181a',
      bgActive: '#2a2e32',
      border: '#31363b',
      textMain: '#fcfcfc',
      textMuted: '#7f8c8d',
      accent: '#3daee9',
      accentHover: '#1d99f3',
    },
  },
];

function adjustHexBrightness(hex: string, delta: number): string {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return hex;

  let r = (num >> 16) + delta;
  let g = ((num >> 8) & 0x00ff) + delta;
  let b = (num & 0x0000ff) + delta;

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function deriveUiPalette(theme: ITheme): UiThemePalette {
  const bg = theme.background || '#0f172a';
  const fg = theme.foreground || '#f8fafc';
  const accent = theme.cyan || theme.blue || theme.magenta || '#06b6d4';
  const border = theme.brightBlack || theme.selectionBackground || '#334155';

  return {
    bgApp: bg,
    bgSurface: adjustHexBrightness(bg, -10),
    bgHeader: adjustHexBrightness(bg, -18),
    bgActive: theme.selectionBackground || adjustHexBrightness(bg, 18),
    border: border,
    textMain: fg,
    textMuted: theme.brightBlack || theme.white || '#94a3b8',
    accent: accent,
    accentHover: theme.brightCyan || theme.brightBlue || accent,
  };
}

export function getThemeById(id: string): ITheme {
  const found = PRESET_THEMES.find((t) => t.id === id);
  return found ? found.theme : PRESET_THEMES[0].theme;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const SEMANTIC: Record<ThemeMode, Pick<ResolvedUiPalette, 'success' | 'warning' | 'danger' | 'info' | 'overlay'>> = {
  dark: { success: '#5fd38d', warning: '#e5b567', danger: '#f27d84', info: '#6ea8fe', overlay: 'rgba(0, 0, 0, 0.6)' },
  light: { success: '#1a7f4b', warning: '#9a6700', danger: '#c62828', info: '#1d5fd0', overlay: 'rgba(15, 17, 21, 0.45)' },
};

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${((1 << 24) + (m(ar, br) << 16) + (m(ag, bg) << 8) + m(ab, bb)).toString(16).slice(1)}`;
}

/** Moves `fg` toward `target` until it reaches `min` contrast against `bg`. */
function ensureContrast(fg: string, bg: string, target: string, min: number): string {
  let out = fg;
  for (let t = 0.1; t <= 1.001 && contrastRatio(out, bg) < min; t += 0.1) {
    out = mixHex(fg, target, t);
  }
  return out;
}

/** Completes a base palette with mode, on-accent text and semantic colors. */
export function resolveUiPalette(base: UiThemePalette): ResolvedUiPalette {
  const mode: ThemeMode = relativeLuminance(base.bgApp) > 0.4 ? 'light' : 'dark';
  const onAccent = contrastRatio(base.accent, '#ffffff') >= contrastRatio(base.accent, '#0b0d12') ? '#ffffff' : '#0b0d12';
  const textMuted = ensureContrast(base.textMuted, base.bgSurface, base.textMain, 4.5);
  return { ...base, textMuted, mode, onAccent, ...SEMANTIC[mode] };
}

export function getUiPaletteByThemeId(id: string, customThemes: TerminalTheme[] = []): ResolvedUiPalette {
  const all = [...PRESET_THEMES, ...customThemes];
  const found = all.find((t) => t.id === id);
  if (found) {
    return resolveUiPalette(found.ui || deriveUiPalette(found.theme));
  }
  return resolveUiPalette(PRESET_THEMES[0].ui!);
}

export function themeModeById(id: string, customThemes: TerminalTheme[] = []): ThemeMode {
  return getUiPaletteByThemeId(id, customThemes).mode;
}
