import React, { useState, useCallback } from 'react';
import type { SerializedValue } from '../lib/serializer';

interface ObjectTreeProps {
  value: SerializedValue;
  depth?: number;
  label?: string;
  onSelectLine?: (line: number) => void;
}

const MAX_PREVIEW_ITEMS = 5;

function getPreview(value: SerializedValue): string {
  switch (value.__type) {
    case 'primitive':
      if (value.value === null) return 'null';
      if (value.value === undefined) return 'undefined';
      if (typeof value.value === 'string') return `"${value.value.slice(0, 60)}${value.value.length > 60 ? '…' : ''}"`;
      return String(value.value);
    case 'bigint': return `${value.value}n`;
    case 'symbol': return value.value;
    case 'date': return `Date(${value.value})`;
    case 'regexp': return value.value;
    case 'function': return value.value;
    case 'circular': return `[Circular → ${value.ref}]`;
    case 'error': return `${value.name}: ${value.message}${value.lineNumber ? ` (Line ${value.lineNumber})` : ''}`;
    case 'map': return `Map(${value.entries.length})`;
    case 'set': return `Set(${value.values.length})`;
    case 'array': {
      if (value.items.length === 0) return '[]';
      const preview = value.items.slice(0, MAX_PREVIEW_ITEMS).map(getPreview).join(', ');
      const more = value.length > MAX_PREVIEW_ITEMS ? `, … +${value.length - MAX_PREVIEW_ITEMS}` : '';
      return `[${preview}${more}]`;
    }
    case 'object': {
      if (value.keys.length === 0) return value.constructorName ? `${value.constructorName} {}` : '{}';
      const preview = value.keys.slice(0, MAX_PREVIEW_ITEMS)
        .map((k, i) => `${k}: ${getPreview(value.values[i])}`)
        .join(', ');
      const more = value.keys.length > MAX_PREVIEW_ITEMS ? `, …` : '';
      const prefix = value.constructorName ? `${value.constructorName} ` : '';
      return `${prefix}{${preview}${more}}`;
    }
    default: return '[Unknown]';
  }
}

function isExpandable(value: SerializedValue): boolean {
  return (
    value.__type === 'array' ||
    value.__type === 'object' ||
    value.__type === 'map' ||
    value.__type === 'set' ||
    (value.__type === 'error' && !!value.stack)
  );
}

function ValueChip({ value }: { value: SerializedValue }) {
  const cls = (() => {
    switch (value.__type) {
      case 'primitive':
        if (typeof value.value === 'string') return 'val-string';
        if (typeof value.value === 'number') return 'val-number';
        if (typeof value.value === 'boolean') return 'val-boolean';
        if (value.value === null || value.value === undefined) return 'val-null';
        return 'val-default';
      case 'bigint': return 'val-number';
      case 'symbol': return 'val-symbol';
      case 'function': return 'val-function';
      case 'circular': return 'val-circular';
      case 'error': return 'val-error-chip';
      default: return 'val-default';
    }
  })();
  return <span className={`value-chip ${cls}`}>{getPreview(value)}</span>;
}

export function ObjectTree({ value, depth = 0, label, onSelectLine }: ObjectTreeProps) {
  const [expanded, setExpanded] = useState(depth === 0 && isExpandable(value));
  const toggle = useCallback(() => setExpanded(e => !e), []);

  const canExpand = isExpandable(value);
  const indent = depth * 16;

  if (!canExpand) {
    return (
      <span className="tree-leaf" style={{ paddingLeft: indent }}>
        {label && <span className="tree-key">{label}: </span>}
        <ValueChip value={value} />
        {value.__type === 'error' && value.lineNumber && onSelectLine && (
          <button
            type="button"
            className="error-line-link"
            onClick={(e) => {
              e.stopPropagation();
              onSelectLine(value.lineNumber!);
            }}
            title={`Jump to line ${value.lineNumber}`}
          >
            Line {value.lineNumber}
          </button>
        )}
      </span>
    );
  }

  return (
    <div className="tree-node" style={{ paddingLeft: indent }}>
      <button className="tree-toggle" onClick={toggle} aria-expanded={expanded}>
        <span className="tree-arrow">{expanded ? '▾' : '▸'}</span>
        {label && <span className="tree-key">{label}: </span>}
        <span className="tree-preview">{getPreview(value)}</span>
        {value.__type === 'error' && value.lineNumber && onSelectLine && (
          <span
            className="error-line-link"
            onClick={(e) => {
              e.stopPropagation();
              onSelectLine(value.lineNumber!);
            }}
            title={`Jump to line ${value.lineNumber}`}
          >
            Line {value.lineNumber}
          </span>
        )}
      </button>

      {expanded && (
        <div className="tree-children">
          {value.__type === 'array' && value.items.map((item, i) => (
            <ObjectTree key={i} value={item} depth={depth + 1} label={String(i)} onSelectLine={onSelectLine} />
          ))}

          {value.__type === 'object' && value.keys.map((key, i) => (
            <ObjectTree key={key} value={value.values[i]} depth={depth + 1} label={key} onSelectLine={onSelectLine} />
          ))}

          {value.__type === 'map' && value.entries.map(([k, v], i) => (
            <div key={i} className="tree-map-entry" style={{ paddingLeft: (depth + 1) * 16 }}>
              <ObjectTree value={k} depth={0} onSelectLine={onSelectLine} />
              <span className="tree-arrow"> → </span>
              <ObjectTree value={v} depth={0} onSelectLine={onSelectLine} />
            </div>
          ))}

          {value.__type === 'set' && value.values.map((v, i) => (
            <ObjectTree key={i} value={v} depth={depth + 1} label={String(i)} onSelectLine={onSelectLine} />
          ))}

          {value.__type === 'error' && value.stack && (
            <pre className="tree-stack">{value.stack}</pre>
          )}
        </div>
      )}
    </div>
  );
}
