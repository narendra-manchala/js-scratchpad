/**
 * Web Worker: Sandboxed JavaScript execution engine.
 *
 * - Transpiles TypeScript → JavaScript via Sucrase (type-stripping only)
 * - Intercepts console.log/warn/error/info/table
 * - Wraps user code in an async IIFE with strict mode
 * - Handles top-level await, return value capture, and errors
 * - Sends structured messages back to the main thread
 */

import { transform } from 'sucrase';
import { serialize, serializeArgs, type SerializedValue } from './lib/serializer';

type WorkerOutboundMessage =
  | { type: 'console'; level: 'log' | 'warn' | 'error' | 'info' | 'table'; args: SerializedValue[] }
  | { type: 'return'; value: SerializedValue }
  | { type: 'perf'; action: 'mark' | 'measure'; name: string; duration?: number; startTime: number }
  | { type: 'done'; elapsed: number }
  | { type: 'error'; message: string; name: string; stack?: string; lineNumber?: number };

type WorkerInboundMessage = {
  cmd: 'run';
  code: string;
  packages: string[];
};

// Helper: create AsyncFunction constructor
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => () => Promise<unknown>;

function send(msg: WorkerOutboundMessage) {
  self.postMessage(msg);
}

// ── Console patching ──────────────────────────────────────────────────────────
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  table: console.table.bind(console),
  time: console.time?.bind(console),
  timeLog: console.timeLog?.bind(console),
  timeEnd: console.timeEnd?.bind(console),
};

const timers = new Map<string, number>();

function patchConsole() {
  const levels = ['log', 'warn', 'error', 'info', 'table'] as const;
  for (const level of levels) {
    (console as unknown as Record<string, unknown>)[level] = (...args: unknown[]) => {
      try { originalConsole[level](...args); } catch {}
      send({ type: 'console', level, args: serializeArgs(args) });
    };
  }

  (console as any).time = (label = 'default') => {
    try { originalConsole.time?.(label); } catch {}
    timers.set(label, performance.now());
  };

  (console as any).timeLog = (label = 'default', ...args: unknown[]) => {
    try { originalConsole.timeLog?.(label, ...args); } catch {}
    const start = timers.get(label);
    if (start === undefined) {
      send({ type: 'console', level: 'warn', args: serializeArgs([`Timer '${label}' does not exist`]) });
      return;
    }
    const elapsed = performance.now() - start;
    send({ type: 'console', level: 'info', args: serializeArgs([`${label}: ${elapsed.toFixed(3)} ms`, ...args]) });
  };

  (console as any).timeEnd = (label = 'default') => {
    try { originalConsole.timeEnd?.(label); } catch {}
    const start = timers.get(label);
    if (start === undefined) {
      send({ type: 'console', level: 'warn', args: serializeArgs([`Timer '${label}' does not exist`]) });
      return;
    }
    const elapsed = performance.now() - start;
    timers.delete(label);
    send({ type: 'console', level: 'info', args: serializeArgs([`${label}: ${elapsed.toFixed(3)} ms - timer ended`]) });
  };
}

patchConsole();

// ── Performance patching ────────────────────────────────────────────────────────
const originalPerformance = {
  mark: performance.mark.bind(performance),
  measure: performance.measure.bind(performance),
  clearMarks: performance.clearMarks.bind(performance),
  clearMeasures: performance.clearMeasures.bind(performance),
};

(performance as any).mark = (name: string, options?: PerformanceMarkOptions) => {
  const entry = originalPerformance.mark(name, options);
  send({ type: 'perf', action: 'mark', name: entry.name, startTime: entry.startTime });
  return entry;
};

(performance as any).measure = (name: string, startMark?: string, endMark?: string) => {
  const entry = originalPerformance.measure(name, startMark, endMark);
  send({ type: 'perf', action: 'measure', name: entry.name, duration: entry.duration, startTime: entry.startTime });
  return entry;
};

// ── TypeScript → JavaScript transpilation ─────────────────────────────────────
function rewriteImports(code: string, packages: string[]): string {
  // Regex to match ES6 imports and convert to dynamic imports via esm.sh
  const importRegex = /import\s+(?:([\w*{},\s]+)\s+from\s+)?['"]([^'"]+)['"]\s*;?/g;

  return code.replace(importRegex, (match, clauses, pkg) => {
    // Check if the package is installed (or is a valid URL/local path)
    if (!pkg.startsWith('http') && !pkg.startsWith('.') && !pkg.startsWith('/')) {
      const isInstalled = packages.some(p => pkg === p || pkg.startsWith(p + '/'));
      if (!isInstalled) {
        throw new Error(`Package '${pkg}' is not installed. Please add it via the Packages menu.`);
      }
      pkg = `https://esm.sh/${pkg}`;
    }
    
    if (!clauses) {
      return `await import("${pkg}");`;
    }

    clauses = clauses.trim();
    
    // import * as name from 'pkg'
    if (clauses.startsWith('* as ')) {
      const alias = clauses.replace('* as ', '').trim();
      return `const ${alias} = await import("${pkg}");`;
    }

    // import { a, b as c } from 'pkg'
    if (clauses.startsWith('{')) {
      const destructured = clauses.replace(/\s+as\s+/g, ': ');
      return `const ${destructured} = await import("${pkg}");`;
    }

    // import defaultName, { a } from 'pkg'
    if (clauses.includes('{')) {
      const defaultName = clauses.split(',')[0].trim();
      const namedPart = clauses.substring(clauses.indexOf('{')).replace(/\s+as\s+/g, ': ');
      return `const __mod_${defaultName} = await import("${pkg}");\nconst ${defaultName} = __mod_${defaultName}.default;\nconst ${namedPart} = __mod_${defaultName};`;
    }

    // import defaultName from 'pkg'
    return `const ${clauses} = (await import("${pkg}")).default;`;
  });
}

function transpile(tsCode: string, packages: string[]): string {
  const codeWithDynamicImports = rewriteImports(tsCode, packages);
  const { code } = transform(codeWithDynamicImports, {
    transforms: ['typescript'],
    jsxRuntime: 'classic',
    production: false,
  });
  return code;
}

// ── Message handler ───────────────────────────────────────────────────────────
// Wrapper prepends 2 lines before user code:
//   line 1: "use strict";
//   line 2: const __result = await (async () => {
//   line 3+: user code
const WRAPPER_LINE_OFFSET = 2;

self.addEventListener('message', async (event: MessageEvent<WorkerInboundMessage>) => {
  if (event.data?.cmd !== 'run') return;

  const { code } = event.data;
  const startTime = performance.now();

  try {
    // Step 0: Check if pure JSON
    const trimmed = code.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        send({ type: 'return', value: serialize(parsed) });
        const elapsed = performance.now() - startTime;
        send({ type: 'done', elapsed });
        return;
      } catch {
        // Not valid JSON, proceed as JS/TS
      }
    }

    // Step 1: Strip TypeScript types → plain JavaScript
    const jsCode = transpile(code, event.data.packages || []);

    // Step 2: Wrap in async IIFE so top-level await works and return is captured
    const wrappedCode = `"use strict";\nconst __result = await (async () => {\n${jsCode}\n})();\n__result`;

    // Step 3: Execute via AsyncFunction (sandboxed from main thread)
    const asyncFn = new AsyncFunction(wrappedCode);
    const result = await asyncFn();

    if (result !== undefined) {
      send({ type: 'return', value: serialize(result) });
    }

    const elapsed = performance.now() - startTime;
    send({ type: 'done', elapsed });

  } catch (err: unknown) {
    const elapsed = performance.now() - startTime;

    if (err instanceof Error) {
      let lineNumber: number | undefined;
      let stack = err.stack;
      
      // If the error has a 'loc' property, it's a compilation/syntax error from Sucrase
      if ((err as any).loc) {
        lineNumber = (err as any).loc.line;
        stack = undefined; // Hide the useless Sucrase internal stack trace
      } else {
        // Adjust line numbers for runtime errors to map back to user's original code
        stack = err.stack?.replace(
          /<anonymous>:(\d+)/g,
          (_, lineStr) => `<anonymous>:${Math.max(1, parseInt(lineStr) - WRAPPER_LINE_OFFSET)}`
        );

        const lineMatch = stack?.match(/<anonymous>:(\d+)/);
        lineNumber = lineMatch ? parseInt(lineMatch[1]) : undefined;
      }

      send({
        type: 'error',
        message: err.message,
        name: err.name,
        stack,
        lineNumber,
      });
    } else {
      send({ type: 'error', message: String(err), name: 'Error' });
    }

    send({ type: 'done', elapsed });
  }
});
