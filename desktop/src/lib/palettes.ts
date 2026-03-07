export type Palette =
  | 'default-dark'
  | 'default-light'
  | 'catppuccin-mocha'
  | 'catppuccin-latte'
  | 'rose-pine'
  | 'rose-pine-dawn';

export type PaletteInfo = {
  id: Palette;
  label: string;
  family: string;
  isDark: boolean;
  preview: { bg: string; fg: string; accent: string; accent2: string };
  terminal: Record<string, string>;
};

const PAIRS: Record<string, [Palette, Palette]> = {
  default: ['default-light', 'default-dark'],
  catppuccin: ['catppuccin-latte', 'catppuccin-mocha'],
  'rose-pine': ['rose-pine-dawn', 'rose-pine'],
};

const DARK_SET = new Set<Palette>(['default-dark', 'catppuccin-mocha', 'rose-pine']);

export function isDarkPalette(p: Palette): boolean {
  return DARK_SET.has(p);
}

export function getFamily(p: Palette): string {
  if (p.startsWith('default')) return 'default';
  if (p.startsWith('catppuccin')) return 'catppuccin';
  return 'rose-pine';
}

export function getPairedPalette(p: Palette): Palette {
  const family = getFamily(p);
  const pair = PAIRS[family];
  return pair[0] === p ? pair[1] : pair[0];
}

export const PALETTES: PaletteInfo[] = [
  {
    id: 'default-light',
    label: 'Default Light',
    family: 'default',
    isDark: false,
    preview: { bg: '#f8f8fa', fg: '#1a1a2e', accent: '#3b5bdb', accent2: '#51cf66' },
    terminal: {
      background: '#ffffff',
      foreground: '#383a42',
      cursor: '#383a42',
      cursorAccent: '#ffffff',
      selectionBackground: '#add6ff',
      selectionForeground: '#000000',
      black: '#383a42', red: '#e45649', green: '#50a14f', yellow: '#c18401',
      blue: '#4078f2', magenta: '#a626a4', cyan: '#0184bc', white: '#fafafa',
      brightBlack: '#a0a1a7', brightRed: '#e45649', brightGreen: '#50a14f', brightYellow: '#c18401',
      brightBlue: '#4078f2', brightMagenta: '#a626a4', brightCyan: '#0184bc', brightWhite: '#ffffff',
    },
  },
  {
    id: 'default-dark',
    label: 'Default Dark',
    family: 'default',
    isDark: true,
    preview: { bg: '#1a1a24', fg: '#e8e8e8', accent: '#7c9eff', accent2: '#69db7c' },
    terminal: {
      background: '#1a1a1a',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      cursorAccent: '#1a1a1a',
      selectionBackground: '#264f78',
      selectionForeground: '#ffffff',
      black: '#1a1a1a', red: '#f44747', green: '#6a9955', yellow: '#d7ba7d',
      blue: '#569cd6', magenta: '#c586c0', cyan: '#4ec9b0', white: '#d4d4d4',
      brightBlack: '#808080', brightRed: '#f44747', brightGreen: '#6a9955', brightYellow: '#d7ba7d',
      brightBlue: '#569cd6', brightMagenta: '#c586c0', brightCyan: '#4ec9b0', brightWhite: '#ffffff',
    },
  },
  {
    id: 'catppuccin-mocha',
    label: 'Mocha',
    family: 'catppuccin',
    isDark: true,
    preview: { bg: '#1e1e2e', fg: '#cdd6f4', accent: '#cba6f7', accent2: '#a6e3a1' },
    terminal: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      cursorAccent: '#1e1e2e',
      selectionBackground: '#45475a',
      selectionForeground: '#cdd6f4',
      black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
      blue: '#89b4fa', magenta: '#cba6f7', cyan: '#94e2d5', white: '#bac2de',
      brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1', brightYellow: '#f9e2af',
      brightBlue: '#89b4fa', brightMagenta: '#cba6f7', brightCyan: '#94e2d5', brightWhite: '#a6adc8',
    },
  },
  {
    id: 'catppuccin-latte',
    label: 'Latte',
    family: 'catppuccin',
    isDark: false,
    preview: { bg: '#eff1f5', fg: '#4c4f69', accent: '#8839ef', accent2: '#40a02b' },
    terminal: {
      background: '#eff1f5',
      foreground: '#4c4f69',
      cursor: '#dc8a78',
      cursorAccent: '#eff1f5',
      selectionBackground: '#acb0be',
      selectionForeground: '#4c4f69',
      black: '#5c5f77', red: '#d20f39', green: '#40a02b', yellow: '#df8e1d',
      blue: '#1e66f5', magenta: '#8839ef', cyan: '#179299', white: '#acb0be',
      brightBlack: '#6c6f85', brightRed: '#d20f39', brightGreen: '#40a02b', brightYellow: '#df8e1d',
      brightBlue: '#1e66f5', brightMagenta: '#8839ef', brightCyan: '#179299', brightWhite: '#bcc0cc',
    },
  },
  {
    id: 'rose-pine',
    label: 'Rosé Pine',
    family: 'rose-pine',
    isDark: true,
    preview: { bg: '#191724', fg: '#e0def4', accent: '#c4a7e7', accent2: '#9ccfd8' },
    terminal: {
      background: '#191724',
      foreground: '#e0def4',
      cursor: '#524f67',
      cursorAccent: '#e0def4',
      selectionBackground: '#2a283e',
      selectionForeground: '#e0def4',
      black: '#26233a', red: '#eb6f92', green: '#9ccfd8', yellow: '#f6c177',
      blue: '#31748f', magenta: '#c4a7e7', cyan: '#ebbcba', white: '#e0def4',
      brightBlack: '#6e6a86', brightRed: '#eb6f92', brightGreen: '#9ccfd8', brightYellow: '#f6c177',
      brightBlue: '#31748f', brightMagenta: '#c4a7e7', brightCyan: '#ebbcba', brightWhite: '#e0def4',
    },
  },
  {
    id: 'rose-pine-dawn',
    label: 'Rosé Dawn',
    family: 'rose-pine',
    isDark: false,
    preview: { bg: '#faf4ed', fg: '#575279', accent: '#907aa9', accent2: '#56949f' },
    terminal: {
      background: '#faf4ed',
      foreground: '#575279',
      cursor: '#cecacd',
      cursorAccent: '#575279',
      selectionBackground: '#dfdad9',
      selectionForeground: '#575279',
      black: '#f2e9e1', red: '#b4637a', green: '#56949f', yellow: '#ea9d34',
      blue: '#286983', magenta: '#907aa9', cyan: '#d7827e', white: '#575279',
      brightBlack: '#9893a5', brightRed: '#b4637a', brightGreen: '#56949f', brightYellow: '#ea9d34',
      brightBlue: '#286983', brightMagenta: '#907aa9', brightCyan: '#d7827e', brightWhite: '#575279',
    },
  },
];

export function getPalette(id: Palette): PaletteInfo {
  return PALETTES.find(p => p.id === id) || PALETTES[0];
}
