/**
 * Debounced localStorage helpers for code persistence.
 */

const STORAGE_KEY = 'js-scratchpad:code';
const TIMEOUT_KEY = 'js-scratchpad:timeout';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function saveCode(code: string, delay = 500): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Storage quota exceeded — silently ignore
    }
    debounceTimer = null;
  }, delay);
}

export function loadCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveTimeout(ms: number): void {
  try {
    localStorage.setItem(TIMEOUT_KEY, String(ms));
  } catch {}
}

export function loadTimeout(): number | null {
  try {
    const val = localStorage.getItem(TIMEOUT_KEY);
    if (val === null) return null;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}
