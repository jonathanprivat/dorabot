import { useState, useCallback } from 'react';

export type EditorPrefs = {
  fontSize: number;
  tabSize: number;
  wordWrap: 'off' | 'on';
  minimap: boolean;
  lineNumbers: 'on' | 'off';
};

const STORAGE_KEY = 'dorabot:editorPrefs';

const DEFAULTS: EditorPrefs = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: 'off',
  minimap: false,
  lineNumbers: 'on',
};

function load(): EditorPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function useEditorPrefs() {
  const [prefs, setPrefs] = useState<EditorPrefs>(load);

  const update = useCallback((partial: Partial<EditorPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { prefs, update };
}

// For reading without the hook (e.g. in MonacoEditor)
export function getEditorPrefs(): EditorPrefs {
  return load();
}
