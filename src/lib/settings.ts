const SETTINGS_KEY = 'js-scratchpad:settings';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface Settings {
  theme: ThemeMode;
  fontSize: number;       // 12 | 13 | 14 | 16 | 18
  tabSize: number;        // 2 | 4
  wordWrap: boolean;
  consoleFontSize: number; // 11 | 12 | 13 | 14
  githubToken: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  consoleFontSize: 12.5,
  githubToken: '',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}
