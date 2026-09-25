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
  | { type: 'done'; elapsed: number }
  | { type: 'error'; message: string; name: string; stack?: string; lineNumber?: number };

type WorkerInboundMessage = {
  cmd: 'run';
  code: string;
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
};

function patchConsole() {
  const levels = ['log', 'warn', 'error', 'info', 'table'] as const;
  for (const level of levels) {
    (console as unknown as Record<string, unknown>)[level] = (...args: unknown[]) => {
      try { originalConsole[level](...args); } catch {}
      send({ type: 'console', level, args: serializeArgs(args) });
    };
  }
}

patchConsole();

// ── TypeScript → JavaScript transpilation ─────────────────────────────────────
function transpile(tsCode: string): string {
  const { code } = transform(tsCode, {
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
    // Step 1: Strip TypeScript types → plain JavaScript
    const jsCode = transpile(code);

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
      // Adjust line numbers to map back to user's original code
      const adjustedStack = err.stack?.replace(
        /<anonymous>:(\d+)/g,
        (_, lineStr) => `<anonymous>:${Math.max(1, parseInt(lineStr) - WRAPPER_LINE_OFFSET)}`
      );

      const lineMatch = adjustedStack?.match(/<anonymous>:(\d+)/);
      const lineNumber = lineMatch ? parseInt(lineMatch[1]) : undefined;

      send({
        type: 'error',
        message: err.message,
        name: err.name,
        stack: adjustedStack ?? err.stack,
        lineNumber,
      });
    } else {
      send({ type: 'error', message: String(err), name: 'Error' });
    }

    send({ type: 'done', elapsed });
  }
});
