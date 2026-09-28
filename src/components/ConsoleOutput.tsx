import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { LogEntry, HistoryEntry } from '../hooks/useCodeRunner';
import { ObjectTree } from './ObjectTree';
import type { SerializedValue } from '../lib/serializer';

type FilterLevel = 'all' | 'log' | 'warn' | 'error' | 'info';

interface ConsoleOutputProps {
  entries: LogEntry[];
  execTime: number | null;
  isRunning: boolean;
  history: HistoryEntry[];
  historyIdx: number;       // -1 = live
  onViewHistory: (idx: number) => void;
  consoleFontSize: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function levelBadge(level: string): { label: string; className: string } {
  switch (level) {
    case 'error':  return { label: 'ERR',      className: 'badge-error' };
    case 'warn':   return { label: 'WARN',     className: 'badge-warn' };
    case 'info':   return { label: 'INFO',     className: 'badge-info' };
    case 'table':  return { label: 'TABLE',    className: 'badge-table' };
    case 'return': return { label: '↩ RET',    className: 'badge-return' };
    case 'system': return { label: 'SYS',      className: 'badge-system' };
    case 'perf':   return { label: '⏱ PERF',   className: 'badge-perf' };
    default:       return { label: 'LOG',      className: 'badge-log' };
  }
}

function valueToText(value: SerializedValue, depth = 0): string {
  const indent = '  '.repeat(depth);
  switch (value.__type) {
    case 'primitive':
      if (value.value === null) return 'null';
      if (value.value === undefined) return 'undefined';
      if (typeof value.value === 'string') return depth === 0 ? value.value : `"${value.value}"`;
      return String(value.value);
    case 'bigint': return `${value.value}n`;
    case 'symbol': return value.value;
    case 'date': return `Date(${value.value})`;
    case 'regexp': return value.value;
    case 'function': return value.value;
    case 'circular': return `[Circular → ${value.ref}]`;
    case 'error': return value.stack ?? `${value.name}: ${value.message}${value.lineNumber ? ` (Line ${value.lineNumber})` : ''}`;
    case 'map': {
      const entries = value.entries.map(([k, v]) => `${indent}  ${valueToText(k, depth + 1)} => ${valueToText(v, depth + 1)}`);
      return `Map(${value.entries.length}) {\n${entries.join(',\n')}\n${indent}}`;
    }
    case 'set': {
      const vals = value.values.map(v => `${indent}  ${valueToText(v, depth + 1)}`);
      return `Set(${value.values.length}) {\n${vals.join(',\n')}\n${indent}}`;
    }
    case 'array': {
      if (value.items.length === 0) return '[]';
      const items = value.items.map(item => `${indent}  ${valueToText(item, depth + 1)}`);
      const more = value.length > value.items.length ? `\n${indent}  ... +${value.length - value.items.length} more` : '';
      return `[\n${items.join(',\n')}${more}\n${indent}]`;
    }
    case 'object': {
      if (value.keys.length === 0) return value.constructorName ? `${value.constructorName} {}` : '{}';
      const pairs = value.keys.map((k, i) => `${indent}  ${k}: ${valueToText(value.values[i], depth + 1)}`);
      const prefix = value.constructorName ? `${value.constructorName} ` : '';
      return `${prefix}{\n${pairs.join(',\n')}\n${indent}}`;
    }
    default: return '[Unknown]';
  }
}

function entryToText(entry: LogEntry): string {
  return entry.args.map(a => valueToText(a)).join(' ');
}

function allToText(entries: LogEntry[]): string {
  return entries.map(e => `[${e.level.toUpperCase()}] ${entryToText(e)}`).join('\n');
}

// ── Deduplication ─────────────────────────────────────────────────────────────
interface DedupEntry extends LogEntry { count: number }

function dedup(entries: LogEntry[]): DedupEntry[] {
  const result: DedupEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.level}||${entry.args.map(a => JSON.stringify(a)).join('|')}`;
    const prev = result[result.length - 1];
    const prevKey = prev ? `${prev.level}||${prev.args.map(a => JSON.stringify(a)).join('|')}` : null;
    if (prevKey === key) {
      prev.count++;
    } else {
      result.push({ ...entry, count: 1 });
    }
  }
  return result;
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ getText, title = 'Copy' }: { getText: () => string; title?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const handle = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setStatus('copied'); setTimeout(() => setStatus('idle'), 1800);
    } catch {
      setStatus('error'); setTimeout(() => setStatus('idle'), 1800);
    }
  }, [getText]);
  return (
    <button className={`copy-btn copy-btn-${status}`} onClick={handle} title={title} aria-label={title}>
      {status === 'copied'
        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        : status === 'error'
        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
      }
      <span className="copy-btn-label">{status === 'copied' ? 'Copied!' : status === 'error' ? 'Failed' : title}</span>
    </button>
  );
}

// ── Table view ────────────────────────────────────────────────────────────────
function TableView({ args }: { args: SerializedValue[] }) {
  const first = args[0];
  if (first.__type !== 'array' && first.__type !== 'object') return <ObjectTree value={first} depth={0} />;
  const rows: Array<{ key: string; value: SerializedValue }> = [];
  if (first.__type === 'array') first.items.forEach((item, i) => rows.push({ key: String(i), value: item }));
  else first.keys.forEach((key, i) => rows.push({ key, value: first.values[i] }));
  const colSet = new Set<string>();
  rows.forEach(({ value }) => { if (value.__type === 'object') value.keys.forEach(k => colSet.add(k)); });
  const cols = Array.from(colSet);
  const hasCols = cols.length > 0;
  return (
    <div className="console-table-wrapper">
      <table className="console-table">
        <thead><tr><th>(index)</th>{hasCols ? cols.map(c => <th key={c}>{c}</th>) : <th>Value</th>}</tr></thead>
        <tbody>{rows.map(({ key, value }) => (
          <tr key={key}>
            <td className="table-index">{key}</td>
            {hasCols && value.__type === 'object'
              ? cols.map(col => { const ci = value.keys.indexOf(col); return <td key={col}>{ci >= 0 ? <ObjectTree value={value.values[ci]} depth={0} /> : <span className="val-null">—</span>}</td>; })
              : <td><ObjectTree value={value} depth={0} /></td>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── Single Entry ──────────────────────────────────────────────────────────────
function ConsoleEntry({ entry, count }: { entry: DedupEntry; count: number }) {
  const { label, className } = levelBadge(entry.level);
  const getText = useCallback(() => entryToText(entry), [entry]);
  return (
    <div className={`console-entry entry-${entry.level}`}>
      <span className={`entry-badge ${className}`}>{label}</span>
      <div className="entry-content">
        {entry.level === 'table'
          ? <TableView args={entry.args} />
          : entry.level === 'perf'
          ? (() => {
              const data = JSON.parse((entry.args[0] as any).value as string);
              if (data.action === 'mark') {
                return <div className="perf-mark">Mark <strong>{data.name}</strong> at {data.startTime.toFixed(2)}ms</div>;
              } else {
                return (
                  <div className="perf-measure">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ minWidth: '120px' }}>Measure <strong>{data.name}</strong></span>
                      <div style={{ flex: 1, background: 'var(--border)', height: '6px', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '100%', background: 'linear-gradient(90deg, var(--accent-1) 0%, var(--accent-2) 100%)', opacity: 0.8 }} />
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>{data.duration?.toFixed(2)}ms</span>
                    </div>
                  </div>
                );
              }
            })()
          : <div className="entry-args">
              {entry.args.map((arg, i) => (
                <span key={i} className="entry-arg">
                  <ObjectTree value={arg} depth={0} />
                  {i < entry.args.length - 1 && <span className="arg-sep"> </span>}
                </span>
              ))}
            </div>
        }
      </div>
      {count > 1 && <span className="dedup-badge">{count}</span>}
      <div className="entry-actions"><CopyButton getText={getText} title="Copy" /></div>
    </div>
  );
}

// ── Filter Chips ──────────────────────────────────────────────────────────────
const FILTER_LEVELS: { level: FilterLevel; label: string }[] = [
  { level: 'all',   label: 'All' },
  { level: 'log',   label: 'Log' },
  { level: 'info',  label: 'Info' },
  { level: 'warn',  label: 'Warn' },
  { level: 'error', label: 'Err' },
];

// ── Main export ────────────────────────────────────────────────────────────────
export function ConsoleOutput({
  entries,
  execTime,
  isRunning,
  history,
  historyIdx,
  onViewHistory,
  consoleFontSize,
}: ConsoleOutputProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterLevel>('all');

  // Determine what to display
  const isViewingHistory = historyIdx >= 0 && historyIdx < history.length;
  const displayedEntries = isViewingHistory ? history[historyIdx].entries : entries;
  const displayedExecTime = isViewingHistory ? history[historyIdx].execTime : execTime;

  // Apply dedup → filter
  const processed = useMemo<DedupEntry[]>(() => {
    const d = dedup(displayedEntries);
    if (filter === 'all') return d;
    return d.filter(e =>
      filter === 'error' ? (e.level === 'error') :
      filter === 'warn'  ? (e.level === 'warn')  :
      filter === 'info'  ? (e.level === 'info')  :
      filter === 'log'   ? (e.level === 'log' || e.level === 'return' || e.level === 'system') :
      true
    );
  }, [displayedEntries, filter]);

  React.useEffect(() => {
    if (!isViewingHistory) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, isViewingHistory]);

  const isEmpty = processed.length === 0 && !isRunning;
  const getAllText = useCallback(() => allToText(displayedEntries), [displayedEntries]);

  const goLive = () => onViewHistory(-1);
  const goPrev = () => onViewHistory(Math.min(historyIdx + 1, history.length - 1));
  const goNext = () => onViewHistory(Math.max(historyIdx - 1, -1));

  return (
    <div className="console-output">
      {/* Header */}
      <div className="console-header">
        <span className="console-title">Console</span>

        {/* History navigator */}
        {history.length > 0 && (
          <div className="history-nav">
            <button className="history-btn" onClick={goPrev} disabled={historyIdx >= history.length - 1} title="Older run">◀</button>
            {isViewingHistory
              ? <span className="history-label">Run {history.length - historyIdx}/{history.length}</span>
              : <span className="history-label history-live">● Live</span>
            }
            <button className="history-btn" onClick={goNext} disabled={historyIdx === -1} title="Newer run / live">▶</button>
            {isViewingHistory && (
              <button className="history-live-btn" onClick={goLive} title="Back to live output">Live</button>
            )}
          </div>
        )}

        <div className="console-header-spacer" />

        {displayedExecTime !== null && (
          <span className="exec-timer" title="Execution time">
            ⚡ {displayedExecTime < 1 ? displayedExecTime.toFixed(3) : displayedExecTime.toFixed(1)}ms
          </span>
        )}
        {isRunning && !isViewingHistory && (
          <span className="exec-running"><span className="running-dot" />Running…</span>
        )}
        {displayedEntries.length > 0 && (
          <CopyButton getText={getAllText} title="Copy All" />
        )}
      </div>

      {/* Filter chips */}
      <div className="console-filter-row">
        {FILTER_LEVELS.map(({ level, label }) => (
          <button
            key={level}
            className={`filter-chip ${filter === level ? 'filter-chip-active' : ''}`}
            onClick={() => setFilter(level)}
          >{label}</button>
        ))}
        {isViewingHistory && (
          <span className="history-timestamp">
            {new Date(history[historyIdx].timestamp).toLocaleTimeString()} · {history[historyIdx].filename}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="console-body" style={{ fontSize: consoleFontSize }}>
        {isEmpty && (
          <div className="console-empty">
            <div className="empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
            </div>
            <p>{filter !== 'all' ? `No ${filter} messages` : 'No output yet'}</p>
            {filter === 'all' && <p className="empty-hint">Press <kbd>⌘</kbd><kbd>↵</kbd> to run</p>}
          </div>
        )}
        {processed.map(entry => <ConsoleEntry key={entry.id} entry={entry} count={entry.count} />)}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
