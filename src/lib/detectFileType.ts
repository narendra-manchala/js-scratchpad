/**
 * Heuristics-based file type detection for JS Scratchpad.
 * Detects whether a code snippet is JSON, TypeScript, or JavaScript.
 */

export type DetectedFileType = 'js' | 'ts' | 'json';
export type SupportedLanguage = 'javascript' | 'typescript' | 'json';

/**
 * Strips comments and string literals so keywords inside comments/strings
 * don't trigger false positives.
 */
function stripCommentsAndStrings(code: string): string {
  return code
    // Block comments
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    // Line comments
    .replace(/\/\/[^\n\r]*/g, ' ')
    // Double-quoted strings
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    // Single-quoted strings
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    // Template literals (basic non-nested or simple replacement)
    .replace(/`[\s\S]*?`/g, '``');
}

/**
 * Detects the file type from code content: 'json' | 'ts' | 'js'.
 */
export function detectFileType(code: string): DetectedFileType {
  const trimmed = code.trim();
  if (!trimmed) return 'js';

  // 1. JSON check: Must start and end with { } or [ ] and be parseable by JSON.parse
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not strict JSON, continue to TS / JS checks
    }
  }

  // 2. TypeScript check
  const stripped = stripCommentsAndStrings(trimmed);

  const tsPatterns: RegExp[] = [
    // Interfaces, type aliases, enums
    /\binterface\s+[A-Za-z0-9_$]+/,
    /\btype\s+[A-Za-z0-9_$]+(?:\s*<[^>]+>)?\s*=/,
    /\benum\s+[A-Za-z0-9_$]+/,

    // Class / interface implement / declare
    /\bimplements\s+[A-Za-z0-9_$]+/,
    /\bdeclare\s+(?:const|let|var|function|class|module|namespace|global|type|interface)\b/,
    /\bnamespace\s+[A-Za-z0-9_$]+/,
    /\babstract\s+class\b/,

    // Access modifiers & readonly
    /\b(public|private|protected)\s+(?:readonly\s+)?[A-Za-z0-9_$]+/,
    /\breadonly\s+[A-Za-z0-9_$]+(?:\s*:|\s*;|\s*=)/,

    // Type assertions: `as const`, `as string`, `as Record<...>`, `<string>val`
    /\bas\s+(?:const|string|number|boolean|any|unknown|never|void|symbol|bigint|Record<|Array<|Promise<|[A-Z]\w*)/,
    /\bsatisfies\s+[A-Za-z0-9_$]+/,

    // Explicit type annotations on variables: `const x: number =`, `let y: string;`
    /\b(?:const|let|var)\s+[A-Za-z0-9_$]+\s*:\s*(?:string|number|boolean|any|unknown|never|void|symbol|bigint|Record<|Array<|Promise<|\[\]|[A-Z]\w*)/,

    // Function return type annotations: `): number {`, `): Promise<void> =>`
    /\)\s*:\s*(?:string|number|boolean|any|unknown|never|void|symbol|bigint|Promise<|Record<|Array<|\[\]|[A-Z]\w*)/,

    // Generics in functions: `function fn<T>(`, `const fn = <T>(`
    /\bfunction\s+[A-Za-z0-9_$]*\s*<[A-Za-z0-9_$,\s]+>\s*\(/,
    /=\s*<[A-Za-z0-9_$,\s]+>\s*\(/,

    // Parameter type annotation: `(x: string, y: number)`
    /\(\s*[A-Za-z0-9_$]+\s*:\s*(?:string|number|boolean|any|unknown|never|void|symbol|bigint|[A-Z]\w*)\s*[,)]/,
  ];

  for (const pattern of tsPatterns) {
    if (pattern.test(stripped)) {
      return 'ts';
    }
  }

  // Default to JavaScript
  return 'js';
}

/**
 * Maps a file extension or filename to Monaco language identifier.
 */
export function getLanguageFromFile(filename: string): SupportedLanguage {
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
  return 'javascript';
}

/**
 * Maps a SupportedLanguage to file extension.
 */
export function getExtFromLanguage(lang: SupportedLanguage): '.js' | '.ts' | '.json' {
  switch (lang) {
    case 'json': return '.json';
    case 'typescript': return '.ts';
    default: return '.js';
  }
}

/**
 * Replaces or appends the correct extension for a filename based on language.
 */
export function replaceFileExtension(filename: string, lang: SupportedLanguage): string {
  const ext = getExtFromLanguage(lang);
  const baseName = filename.replace(/\.(js|ts|tsx|json)$/i, '');
  return `${baseName}${ext}`;
}
