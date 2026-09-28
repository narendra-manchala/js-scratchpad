import { useCallback, useEffect, useRef, useState } from 'react';
import type { SerializedValue } from '../lib/serializer';

export type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'table' | 'return' | 'system' | 'perf';

export interface LogEntry {
  id: string;
  level: LogLevel;
  args: SerializedValue[];
  timestamp: number;
  elapsed?: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  filename: string;
  entries: LogEntry[];
  execTime: number;
}

type WorkerOutboundMessage =
  | { type: 'console'; level: 'log' | 'warn' | 'error' | 'info' | 'table'; args: SerializedValue[] }
  | { type: 'return'; value: SerializedValue }
  | { type: 'perf'; action: 'mark' | 'measure'; name: string; duration?: number; startTime: number }
  | { type: 'done'; elapsed: number }
  | { type: 'error'; message: string; name: string; stack?: string; lineNumber?: number };

let _id = 0;
function uid(): string { return `entry-${++_id}-${Date.now()}`; }

interface UseCodeRunnerResult {
  entries: LogEntry[];
  isRunning: boolean;
  execTime: number | null;
  runCode: (code: string, timeoutMs: number) => void;
  clearConsole: () => void;
  stopCode: () => void;
}

export function useCodeRunner(): UseCodeRunnerResult {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [execTime, setExecTime] = useState<number | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const appendEntry = useCallback((entry: LogEntry) => {
    setEntries(prev => [...prev, entry]);
  }, []);

  const clearConsole = useCallback(() => {
    setEntries([]);
    setExecTime(null);
  }, []);

  const terminateWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const stopCode = useCallback(() => {
    terminateWorker();
    setIsRunning(false);
    appendEntry({
      id: uid(),
      level: 'system',
      args: [{ __type: 'primitive', value: '⏹ Execution stopped by user.' }],
      timestamp: Date.now(),
    });
  }, [terminateWorker, appendEntry]);

  const runCode = useCallback((code: string, timeoutMs: number) => {
    terminateWorker();
    setIsRunning(true);
    setExecTime(null);
    setEntries([]);

    const worker = new Worker(
      new URL('../runner.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    // Timeout guard
    timeoutRef.current = setTimeout(() => {
      terminateWorker();
      setIsRunning(false);
      appendEntry({
        id: uid(),
        level: 'error',
        args: [{ __type: 'error', message: `Execution timed out after ${timeoutMs / 1000}s. Worker terminated.`, name: 'TimeoutError' }],
        timestamp: Date.now(),
      });
    }, timeoutMs);

    worker.addEventListener('message', (event: MessageEvent<WorkerOutboundMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'console':
          appendEntry({ id: uid(), level: msg.level, args: msg.args, timestamp: Date.now() });
          break;
        case 'return':
          appendEntry({ id: uid(), level: 'return', args: [msg.value], timestamp: Date.now() });
          break;
        case 'error':
          appendEntry({ id: uid(), level: 'error', args: [{ __type: 'error', message: msg.message, name: msg.name, stack: msg.stack, lineNumber: msg.lineNumber }], timestamp: Date.now() });
          break;
        case 'perf':
          appendEntry({
            id: uid(),
            level: 'perf',
            args: [{
              __type: 'primitive',
              value: JSON.stringify({ action: msg.action, name: msg.name, duration: msg.duration, startTime: msg.startTime })
            }],
            timestamp: Date.now()
          });
          break;
        case 'done':
          if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
          setExecTime(msg.elapsed);
          setIsRunning(false);
          terminateWorker();
          break;
      }
    });

    worker.addEventListener('error', (err: ErrorEvent) => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      appendEntry({ id: uid(), level: 'error', args: [{ __type: 'error', message: err.message || 'Worker error', name: 'WorkerError' }], timestamp: Date.now() });
      setIsRunning(false);
      terminateWorker();
    });

    worker.postMessage({ cmd: 'run', code });
  }, [appendEntry, terminateWorker]);

  return { entries, isRunning, execTime, runCode, clearConsole, stopCode };
}
