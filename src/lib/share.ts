import LZString from 'lz-string';
import type { ScFile } from './files';

export interface SharedSnippetPayload {
  id?: string;
  type?: 'file' | 'project';
  files: ScFile[];
  packages?: string[];
  activeId?: string;
  createdAt?: number;
}

/**
 * Creates a unique, shareable link (e.g. /s/yzsesatp) stored via Upstash Redis.
 * Supports sharing a single file ('file') or the entire multi-file project ('project').
 * Falls back to client-side LZ-string compression in URL hash if the backend is unavailable.
 */
export async function createShareLink(
  files: ScFile[],
  packages: string[],
  activeId: string,
  type: 'file' | 'project' = 'project'
): Promise<string> {
  try {
    const payloadFiles = type === 'file'
      ? files.filter(f => f.id === activeId)
      : files;

    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        files: payloadFiles.length > 0 ? payloadFiles : files,
        packages: type === 'project' ? packages : [],
        activeId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.path) {
        return `${window.location.origin}${data.path}`;
      }
    }
  } catch (err) {
    console.warn('Backend share failed, falling back to URL hash:', err);
  }

  // Fallback: compress active file into URL hash
  const activeFile = files.find(f => f.id === activeId) ?? files[0];
  return getShareableUrl(activeFile ? activeFile.code : '');
}

/**
 * Fetches a shared snippet from the backend by unique ID.
 */
export async function fetchSharedSnippet(id: string): Promise<SharedSnippetPayload | null> {
  try {
    const res = await fetch(`/api/get?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.snippet ?? null;
  } catch (err) {
    console.error('Failed to fetch shared snippet:', err);
    return null;
  }
}

/**
 * Checks if current URL path matches /s/:id
 */
export function getSharedIdFromUrl(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/s\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Legacy LZ-string hash fallback (e.g. #code=...)
 */
export function getShareableUrl(code: string): string {
  const compressed = LZString.compressToEncodedURIComponent(code);
  const url = new URL(window.location.href);
  url.hash = `code=${compressed}`;
  return url.toString();
}

export function getSharedCodeFromUrl(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#code=')) return null;
  const encoded = hash.slice(6); // '#code='.length
  return LZString.decompressFromEncodedURIComponent(encoded);
}

export function clearShareUrl(): void {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
