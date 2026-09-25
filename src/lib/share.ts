import LZString from 'lz-string';

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
