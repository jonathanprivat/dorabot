import { useState, useCallback } from 'react';
import type { Palette } from '../lib/palettes';
import { PALETTES, isDarkPalette, getFamily, getPairedPalette } from '../lib/palettes';

export type Theme = 'light' | 'dark';

const VALID_PALETTES = new Set<string>(PALETTES.map(p => p.id));

function applyToDOM(palette: Palette, glass: boolean) {
  const el = document.documentElement;
  const isDark = isDarkPalette(palette);

  el.setAttribute('data-palette', palette);

  if (isDark) {
    el.classList.add('dark');
  } else {
    el.classList.remove('dark');
  }

  if (glass) {
    el.setAttribute('data-glass', 'true');
  } else {
    el.removeAttribute('data-glass');
  }

  localStorage.setItem('palette', palette);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function initPalette(): Palette {
  const stored = localStorage.getItem('palette');
  if (stored && VALID_PALETTES.has(stored)) return stored as Palette;
  // Invalid or missing: clean up and fall back
  localStorage.removeItem('palette');
  return document.documentElement.classList.contains('dark') ? 'default-dark' : 'default-light';
}

export function useTheme() {
  const [palette, setPaletteState] = useState<Palette>(initPalette);
  const [glass, setGlassState] = useState(() => localStorage.getItem('glass') === 'true');

  const theme: Theme = isDarkPalette(palette) ? 'dark' : 'light';

  const setPalette = useCallback((p: Palette) => {
    setPaletteState(p);
    // Use functional update pattern to get current glass state
    setGlassState(currentGlass => {
      applyToDOM(p, currentGlass);
      return currentGlass;
    });
  }, []);

  const setGlass = useCallback((g: boolean) => {
    setGlassState(g);
    localStorage.setItem('glass', String(g));
    if (g) {
      document.documentElement.setAttribute('data-glass', 'true');
    } else {
      document.documentElement.removeAttribute('data-glass');
    }
  }, []);

  const toggle = useCallback(() => {
    const other = getPairedPalette(palette);
    setPalette(other);
  }, [palette, setPalette]);

  const setTheme = useCallback((t: Theme) => {
    const family = getFamily(palette);
    if (family === 'default') {
      setPalette(t === 'dark' ? 'default-dark' : 'default-light');
    } else if (family === 'catppuccin') {
      setPalette(t === 'dark' ? 'catppuccin-mocha' : 'catppuccin-latte');
    } else {
      setPalette(t === 'dark' ? 'rose-pine' : 'rose-pine-dawn');
    }
  }, [palette, setPalette]);

  return { theme, palette, glass, setTheme, setPalette, setGlass, toggle };
}
