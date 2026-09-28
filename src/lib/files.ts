/**
 * File management helpers — CRUD on ScFile objects stored in localStorage.
 * Each file has a stable ID, a user-editable name, and its own code string.
 */

import { DEFAULT_CODE } from './presets';

export interface ScFile {
  id: string;
  name: string;
  code: string;
  updatedAt: number;
}

const FILES_KEY = 'js-scratchpad:files';
const LEGACY_CODE_KEY = 'js-scratchpad:code';

// ── Persistence ───────────────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveFiles(files: ScFile[], delay = 500): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(FILES_KEY, JSON.stringify(files));
    } catch {}
    saveTimer = null;
  }, delay);
}

export function saveFilesNow(files: ScFile[]): void {
  try {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  } catch {}
}

/** Load files from localStorage, migrating from the legacy single-code key if needed. */
export function loadFiles(): ScFile[] {
  try {
    const raw = localStorage.getItem(FILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ScFile[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // Migration: promote legacy single code snippet → first file
  const legacyCode = (() => {
    try { return localStorage.getItem(LEGACY_CODE_KEY); } catch { return null; }
  })();

  const firstFile = makeFile('untitled-1.js', legacyCode ?? DEFAULT_CODE);
  return [firstFile];
}

// ── File factory ──────────────────────────────────────────────────────────────

export function makeFile(name: string, code = ''): ScFile {
  return {
    id: crypto.randomUUID(),
    name,
    code,
    updatedAt: Date.now(),
  };
}

export function nextUntitledName(files: ScFile[]): string {
  const taken = new Set(files.map(f => f.name));
  let n = 1;
  while (taken.has(`untitled-${n}.js`)) n++;
  return `untitled-${n}.js`;
}

// ── CRUD helpers (return new arrays — treat files as immutable) ───────────────

export function createFile(files: ScFile[]): { files: ScFile[]; newFile: ScFile } {
  const newFile = makeFile(nextUntitledName(files));
  return { files: [...files, newFile], newFile };
}

export function updateFileName(files: ScFile[], id: string, name: string): ScFile[] {
  return files.map(f =>
    f.id === id ? { ...f, name: name.trim() || f.name, updatedAt: Date.now() } : f
  );
}

export function updateFileCode(files: ScFile[], id: string, code: string): ScFile[] {
  return files.map(f =>
    f.id === id ? { ...f, code, updatedAt: Date.now() } : f
  );
}

export function deleteFile(
  files: ScFile[],
  id: string,
  activeId: string
): { files: ScFile[]; nextActiveId: string } {
  const idx = files.findIndex(f => f.id === id);
  const next = files.filter(f => f.id !== id);

  // If we deleted the active file, pick the nearest neighbour
  let nextActiveId = activeId;
  if (id === activeId && next.length > 0) {
    const candidate = next[Math.min(idx, next.length - 1)];
    nextActiveId = candidate.id;
  }

  return { files: next, nextActiveId };
}

export function duplicateFile(files: ScFile[], id: string): { files: ScFile[]; newFile: ScFile } {
  const src = files.find(f => f.id === id);
  if (!src) return { files, newFile: files[0] };

  const baseName = src.name.replace(/\.(ts|js)$/, '');
  const ext = src.name.match(/\.(ts|js)$/)?.[0] || '.js';
  let candidateName = `${baseName}-copy${ext}`;
  const taken = new Set(files.map(f => f.name));
  let n = 2;
  while (taken.has(candidateName)) candidateName = `${baseName}-copy${n++}${ext}`;

  const newFile = makeFile(candidateName, src.code);
  const srcIdx = files.findIndex(f => f.id === id);
  const next = [...files.slice(0, srcIdx + 1), newFile, ...files.slice(srcIdx + 1)];
  return { files: next, newFile };
}
