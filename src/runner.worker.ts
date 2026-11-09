/**
 * Web Worker: Sandboxed JavaScript/TypeScript/WAT execution engine.
 *
 * - Transpiles TypeScript/JavaScript → JavaScript via esbuild-wasm (WASM-powered, ~10× faster than Sucrase)
 * - Compiles WebAssembly Text Format (WAT) → WASM via native WebAssembly.compile
 * - Intercepts console.log/warn/error/info/table
 * - Wraps user code in an async IIFE with strict mode
 * - Handles top-level await, return value capture, and errors
 * - Sends structured messages back to the main thread
 */

import { transform } from 'sucrase';
import { parse } from 'acorn';
import { serialize, serializeArgs, type SerializedValue } from './lib/serializer';

type WorkerOutboundMessage =
  | { type: 'console'; level: 'log' | 'warn' | 'error' | 'info' | 'table'; args: SerializedValue[]; elapsed?: number }
  | { type: 'return'; value: SerializedValue; elapsed?: number }
  | { type: 'perf'; action: 'mark' | 'measure'; name: string; duration?: number; startTime: number }
  | { type: 'done'; elapsed: number }
  | { type: 'error'; message: string; name: string; stack?: string; lineNumber?: number; elapsed?: number };

type WorkerInboundMessage = {
  cmd: 'run';
  code: string;
  packages: string[];
  language?: string; // 'javascript' | 'typescript' | 'json' | 'wat'
};

// Helper: create AsyncFunction constructor
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => () => Promise<unknown>;

function send(msg: WorkerOutboundMessage) {
  self.postMessage(msg);
}

let runStartTime = 0;

function getElapsed(): number {
  return runStartTime > 0 ? Math.max(0, performance.now() - runStartTime) : 0;
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
      send({ type: 'console', level, args: serializeArgs(args), elapsed: getElapsed() });
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
      send({ type: 'console', level: 'warn', args: serializeArgs([`Timer '${label}' does not exist`]), elapsed: getElapsed() });
      return;
    }
    const elapsed = performance.now() - start;
    send({ type: 'console', level: 'info', args: serializeArgs([`${label}: ${elapsed.toFixed(3)} ms`, ...args]), elapsed: getElapsed() });
  };

  (console as any).timeEnd = (label = 'default') => {
    try { originalConsole.timeEnd?.(label); } catch {}
    const start = timers.get(label);
    if (start === undefined) {
      send({ type: 'console', level: 'warn', args: serializeArgs([`Timer '${label}' does not exist`]), elapsed: getElapsed() });
      return;
    }
    const elapsed = performance.now() - start;
    timers.delete(label);
    send({ type: 'console', level: 'info', args: serializeArgs([`${label}: ${elapsed.toFixed(3)} ms - timer ended`]), elapsed: getElapsed() });
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

// ── Async Execution Tracking (Timers, Intervals, Fetch, Rejections) ───────────
let timerSeq = 0;
const activeTimers = new Set<number>();
const realToCustomTimer = new Map<number, number>();

let intervalSeq = 0;
const activeIntervals = new Set<number>();
const realToCustomInterval = new Map<number, number>();

let activeFetches = 0;
let isSyncExecutionDone = false;
let hasSentDone = false;

const originalSetTimeout = self.setTimeout.bind(self);
const originalClearTimeout = self.clearTimeout.bind(self);
const originalSetInterval = self.setInterval.bind(self);
const originalClearInterval = self.clearInterval.bind(self);
const originalFetch = typeof self.fetch === 'function' ? self.fetch.bind(self) : undefined;

// ── Pure-JS Benchmark Suite & Helper ───────────────────────────────────────────
interface BenchmarkResult {
  name: string;
  opsPerSec: number;
  avgTimeNs: number;
  iterations: number;
}

const benchmarkSuite: BenchmarkResult[] = [];

async function bench(
  name: string,
  fn: () => unknown | Promise<unknown>,
  options: { maxTimeMs?: number; maxIterations?: number } = {}
): Promise<BenchmarkResult> {
  const maxTimeMs = options.maxTimeMs ?? 60; // 60ms sampling window
  const maxIterations = options.maxIterations ?? 1_000_000;

  // Warmup
  for (let i = 0; i < 3; i++) {
    const res = fn();
    if (res instanceof Promise) await res;
  }

  // Detect async
  const sample = fn();
  const isAsync = sample instanceof Promise;
  if (isAsync) await sample;

  const start = performance.now();
  let iterations = 1;
  const targetEnd = start + maxTimeMs;

  if (isAsync) {
    while (performance.now() < targetEnd && iterations < maxIterations) {
      await fn();
      iterations++;
    }
  } else {
    while (performance.now() < targetEnd && iterations < maxIterations) {
      for (let j = 0; j < 25; j++) {
        fn();
      }
      iterations += 25;
    }
  }

  const durationMs = performance.now() - start;
  const opsPerSec = Math.round((iterations / (durationMs / 1000)));
  const avgTimeNs = (durationMs * 1_000_000) / iterations;

  const formattedTime =
    avgTimeNs < 1000
      ? `${avgTimeNs.toFixed(1)} ns/op`
      : avgTimeNs < 1_000_000
      ? `${(avgTimeNs / 1000).toFixed(2)} µs/op`
      : `${(avgTimeNs / 1_000_000).toFixed(2)} ms/op`;

  const result: BenchmarkResult = { name, opsPerSec, avgTimeNs, iterations };
  benchmarkSuite.push(result);

  (console as any).log(`⚡ [bench] ${name}: ${opsPerSec.toLocaleString()} ops/sec (${formattedTime}, ${iterations.toLocaleString()} runs)`);

  return result;
}

(self as any).bench = bench;

function checkDone() {
  if (
    isSyncExecutionDone &&
    !hasSentDone &&
    activeTimers.size === 0 &&
    activeIntervals.size === 0 &&
    activeFetches === 0
  ) {
    // If multiple benchmarks were executed, output a clean comparison summary
    if (benchmarkSuite.length > 1) {
      const sorted = [...benchmarkSuite].sort((a, b) => b.opsPerSec - a.opsPerSec);
      const fastest = sorted[0];
      const summary = sorted.map((b, i) => {
        if (i === 0) return `🥇 ${b.name}: ${b.opsPerSec.toLocaleString()} ops/sec (fastest)`;
        const diff = (fastest.opsPerSec / b.opsPerSec).toFixed(1);
        return `   ${b.name}: ${b.opsPerSec.toLocaleString()} ops/sec (${diff}x slower)`;
      });
      (console as any).log(`\n🏆 Benchmark Summary:\n` + summary.join('\n'));
    }

    hasSentDone = true;
    const elapsed = performance.now() - runStartTime;
    send({ type: 'done', elapsed });
  }
}

function patchAsyncApis() {
  (self as any).setTimeout = (handler: TimerHandler, timeout?: number, ...args: any[]) => {
    const customId = ++timerSeq;
    activeTimers.add(customId);

    const wrappedHandler = (...cbArgs: any[]) => {
      activeTimers.delete(customId);
      try {
        if (typeof handler === 'function') {
          handler(...cbArgs);
        } else {
          (0, eval)(handler);
        }
      } catch (err: any) {
        send({
          type: 'error',
          message: err?.message || String(err),
          name: err?.name || 'Error',
          stack: err?.stack,
        });
      } finally {
        checkDone();
      }
    };

    const realId = originalSetTimeout(wrappedHandler, timeout, ...args) as unknown as number;
    realToCustomTimer.set(realId, customId);
    return realId;
  };

  (self as any).clearTimeout = (realId?: number) => {
    if (realId !== undefined) {
      const customId = realToCustomTimer.get(realId);
      if (customId !== undefined) {
        activeTimers.delete(customId);
        realToCustomTimer.delete(realId);
      }
    }
    originalClearTimeout(realId);
    checkDone();
  };

  (self as any).setInterval = (handler: TimerHandler, timeout?: number, ...args: any[]) => {
    const customId = ++intervalSeq;
    activeIntervals.add(customId);

    const wrappedHandler = (...cbArgs: any[]) => {
      try {
        if (typeof handler === 'function') {
          handler(...cbArgs);
        } else {
          (0, eval)(handler);
        }
      } catch (err: any) {
        send({
          type: 'error',
          message: err?.message || String(err),
          name: err?.name || 'Error',
          stack: err?.stack,
        });
      }
    };

    const realId = originalSetInterval(wrappedHandler, timeout, ...args) as unknown as number;
    realToCustomInterval.set(realId, customId);
    return realId;
  };

  (self as any).clearInterval = (realId?: number) => {
    if (realId !== undefined) {
      const customId = realToCustomInterval.get(realId);
      if (customId !== undefined) {
        activeIntervals.delete(customId);
        realToCustomInterval.delete(realId);
      }
    }
    originalClearInterval(realId);
    checkDone();
  };

  if (originalFetch) {
    self.fetch = (async (...args: Parameters<typeof fetch>) => {
      activeFetches++;
      try {
        return await originalFetch(...args);
      } finally {
        activeFetches--;
        checkDone();
      }
    }) as typeof fetch;
  }

  self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    event.preventDefault();
    const reason = event.reason;
    if (reason instanceof Error) {
      send({
        type: 'error',
        message: reason.message,
        name: reason.name,
        stack: reason.stack,
        elapsed: getElapsed(),
      });
    } else {
      send({
        type: 'error',
        message: typeof reason === 'object' && reason !== null ? JSON.stringify(reason) : String(reason),
        name: 'UnhandledPromiseRejection',
        elapsed: getElapsed(),
      });
    }
    checkDone();
  });
}

patchAsyncApis();

function autoReturnLastExpression(code: string): string {
  try {
    const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
    if (ast.body.length > 0) {
      const last = ast.body[ast.body.length - 1];
      if (last.type === 'ExpressionStatement') {
        const expr = (last as any).expression;
        if (expr && typeof expr.start === 'number' && typeof expr.end === 'number') {
          return code.slice(0, expr.start) + 'return (' + code.slice(expr.start, expr.end) + ')' + code.slice(expr.end);
        }
      }
    }
  } catch {
    // If AST parsing fails, fallback safely to original code
  }
  return code;
}

// ── Import rewriting ───────────────────────────────────────────────────────────
function rewriteImports(code: string, packages: string[]): string {
  const importRegex = /import\s+(?:([\w*{},\s]+)\s+from\s+)?['"]([^'"]+)['"]\s*;?/g;

  return code.replace(importRegex, (match, clauses, pkg) => {
    if (!pkg.startsWith('http') && !pkg.startsWith('.') && !pkg.startsWith('/')) {
      const isInstalled = packages.some(p => pkg === p || pkg.startsWith(p + '/'));
      if (!isInstalled) {
        throw new Error(`Package '${pkg}' is not installed. Please add it via the Packages menu.`);
      }
      pkg = `https://esm.sh/${pkg}`;
    }

    if (!clauses) return `await import("${pkg}");`;
    clauses = clauses.trim();

    if (clauses.startsWith('* as ')) {
      const alias = clauses.replace('* as ', '').trim();
      return `const ${alias} = await import("${pkg}");`;
    }
    if (clauses.startsWith('{')) {
      const destructured = clauses.replace(/\s+as\s+/g, ': ');
      return `const ${destructured} = await import("${pkg}");`;
    }
    if (clauses.includes('{')) {
      const defaultName = clauses.split(',')[0].trim();
      const namedPart = clauses.substring(clauses.indexOf('{')).replace(/\s+as\s+/g, ': ');
      return `const __mod_${defaultName} = await import("${pkg}");\nconst ${defaultName} = __mod_${defaultName}.default;\nconst ${namedPart} = __mod_${defaultName};`;
    }
    return `const ${clauses} = (await import("${pkg}")).default;`;
  });
}

// ── TypeScript / JavaScript transpilation via Sucrase (fast, offline) ─────────
function transpile(tsCode: string, packages: string[]): string {
  const source = rewriteImports(tsCode, packages);
  const { code } = transform(source, {
    transforms: ['typescript', 'jsx'],
    jsxRuntime: 'classic',
    preserveDynamicImport: true,
  });
  return code;
}

// ── WAT (WebAssembly Text Format) runner ──────────────────────────────────────
async function runWat(watCode: string): Promise<void> {
  // Use the wat-wasm package from esm.sh to compile WAT → binary
  send({
    type: 'console',
    level: 'info',
    args: serializeArgs(['⚙️  Compiling WAT → WebAssembly…']),
  });

  let wasmBytes: Uint8Array;

  try {
    // wat2wasm via wabt on esm.sh — use indirect import to bypass TS static checks
    // eslint-disable-next-line no-new-func
    const dynamicImport = new Function('url', 'return import(url)');
    const wabtModule = await dynamicImport('https://esm.sh/wabt@1.0.36');
    const { parseWat } = wabtModule;
    const parsed = parseWat('inline.wat', watCode);
    const { buffer } = parsed.toBinary({});
    wasmBytes = new Uint8Array(buffer);
    parsed.destroy();
  } catch (e: any) {
    throw new Error(`WAT compilation failed: ${e.message ?? e}`);
  }

  send({
    type: 'console',
    level: 'info',
    args: serializeArgs([`✅ Compiled — ${wasmBytes.byteLength} bytes`]),
  });

  // Instantiate the compiled module
  const wasmModule = await WebAssembly.compile(wasmBytes.buffer as ArrayBuffer);
  const instance = await WebAssembly.instantiate(wasmModule, {});

  const exports = instance.exports;
  const exportKeys = Object.keys(exports);

  if (exportKeys.length === 0) {
    send({
      type: 'console',
      level: 'warn',
      args: serializeArgs(['⚠️ Module has no exports.']),
    });
    return;
  }

  send({
    type: 'console',
    level: 'info',
    args: serializeArgs([`📦 Exports: ${exportKeys.join(', ')}`]),
  });

  // Auto-call exported functions with no arguments and log results
  for (const key of exportKeys) {
    const exp = exports[key];
    if (typeof exp === 'function') {
      try {
        const result = exp();
        if (result !== undefined) {
          send({
            type: 'console',
            level: 'log',
            args: serializeArgs([`${key}() →`, result]),
          });
        }
      } catch {
        // Function requires args — just log it exists
        send({
          type: 'console',
          level: 'log',
          args: serializeArgs([`${key}: [function]`]),
        });
      }
    } else {
      send({
        type: 'console',
        level: 'log',
        args: serializeArgs([`${key}:`, exp]),
      });
    }
  }

  // Return the full exports object
  send({ type: 'return', value: serialize(Object.fromEntries(exportKeys.map(k => [k, String(exports[k])]))) });
}

// ── Message handler ───────────────────────────────────────────────────────────
// Wrapper prepends 2 lines before user code for line-number correction
const WRAPPER_LINE_OFFSET = 2;

self.addEventListener('message', async (event: MessageEvent<WorkerInboundMessage>) => {
  if (event.data?.cmd !== 'run') return;

  const { code, packages = [], language } = event.data;
  const startTime = performance.now();
  runStartTime = startTime;
  benchmarkSuite.length = 0;

  const isWat = language === 'wat' || code.trimStart().startsWith('(module');

  try {
    // ── WAT path ────────────────────────────────────────────────────────────
    if (isWat) {
      await runWat(code);
      const elapsed = performance.now() - startTime;
      send({ type: 'done', elapsed });
      return;
    }

    // ── JSON path ───────────────────────────────────────────────────────────
    const trimmed = code.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        send({ type: 'return', value: serialize(parsed), elapsed: getElapsed() });
        const elapsed = performance.now() - startTime;
        send({ type: 'done', elapsed });
        return;
      } catch {
        // Not valid JSON, proceed as JS/TS
      }
    }

    // ── JS / TS path — Sucrase (instant, offline) ──────────────────────────
    isSyncExecutionDone = false;
    hasSentDone = false;
    activeTimers.clear();
    realToCustomTimer.clear();
    activeIntervals.clear();
    realToCustomInterval.clear();
    activeFetches = 0;

    let jsCode = transpile(code, packages);
    jsCode = autoReturnLastExpression(jsCode);

    // Wrap in async IIFE so top-level await works and return is captured
    const wrappedCode = `"use strict";\nconst __result = await (async () => {\n${jsCode}\n})();\nreturn __result;`;

    const asyncFn = new AsyncFunction(wrappedCode);
    const result = await asyncFn();

    if (result !== undefined) {
      send({ type: 'return', value: serialize(result), elapsed: getElapsed() });
    }

    isSyncExecutionDone = true;
    await Promise.resolve();
    checkDone();

  } catch (err: unknown) {
    const elapsed = performance.now() - startTime;

    if (err instanceof Error) {
      let lineNumber: number | undefined;
      let stack = err.stack;

      if ((err as any).loc) {
        lineNumber = (err as any).loc.line;
        stack = undefined;
      } else {
        stack = err.stack?.replace(
          /<anonymous>:(\d+)/g,
          (_, lineStr) => `<anonymous>:${Math.max(1, parseInt(lineStr) - WRAPPER_LINE_OFFSET)}`
        );
        const lineMatch = stack?.match(/<anonymous>:(\d+)/);
        lineNumber = lineMatch ? parseInt(lineMatch[1]) : undefined;
      }

      send({ type: 'error', message: err.message, name: err.name, stack, lineNumber, elapsed: getElapsed() });
    } else {
      send({ type: 'error', message: String(err), name: 'Error', elapsed: getElapsed() });
    }

    isSyncExecutionDone = true;
    hasSentDone = true;
    send({ type: 'done', elapsed });
  }
});
