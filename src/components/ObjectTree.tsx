import React, { useState, useCallback } from 'react';
import type { SerializedValue } from '../lib/serializer';

interface ObjectTreeProps {
  value: SerializedValue;
  depth?: number;
  label?: string;
  onSelectLine?: (line: number) => void;
}

const MAX_PREVIEW_ITEMS = 5;

function getShortPreview(value: SerializedValue): string {
  if (value.__type === 'function') return 'ƒ';
  return getPreview(value);
}

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
      if (value.isPrototype && value.keys && value.keys.length > 0) {
        const preview = value.keys.slice(0, MAX_PREVIEW_ITEMS)
          .map((k, i) => `${k}: ${getShortPreview(value.values![i])}`)
          .join(', ');
        const more = value.keys.length > MAX_PREVIEW_ITEMS ? ', …' : '';
        return `[${preview}${more}]`;
      }
      if (value.items.length === 0) return '[]';
      const preview = value.items.slice(0, MAX_PREVIEW_ITEMS).map(getShortPreview).join(', ');
      const more = value.length > MAX_PREVIEW_ITEMS ? `, … +${value.length - MAX_PREVIEW_ITEMS}` : '';
      return `[${preview}${more}]`;
    }
    case 'object': {
      if (value.keys.length === 0) return value.constructorName ? `${value.constructorName} {}` : '{}';
      const preview = value.keys.slice(0, MAX_PREVIEW_ITEMS)
        .map((k, i) => `${k}: ${getShortPreview(value.values[i])}`)
        .join(', ');
      const more = value.keys.length > MAX_PREVIEW_ITEMS ? ', …' : '';
      const prefix = value.constructorName && !value.isPrototype ? `${value.constructorName} ` : '';
      return `${prefix}{${preview}${more}}`;
    }
    default: return '[Unknown]';
  }
}

function isExpandable(value: SerializedValue): boolean {
  if (value.__type === 'array') return value.items.length > 0 || (!!value.keys && value.keys.length > 0) || !!value.proto;
  if (value.__type === 'object') return value.keys.length > 0 || !!value.proto;
  if (value.__type === 'map') return value.entries.length > 0;
  if (value.__type === 'set') return value.values.length > 0;
  if (value.__type === 'error') return !!value.stack;
  return false;
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
  // Collapsed by default, matching browser console behavior
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded(e => !e), []);

  const canExpand = isExpandable(value);
  const indent = depth * 16;
  const isProtoLabel = label === '[[Prototype]]';

  if (!canExpand) {
    return (
      <span className="tree-leaf" style={{ paddingLeft: indent }}>
        {label && (
          <span className={`tree-key ${isProtoLabel ? 'tree-proto-key' : ''}`}>
            {label}:{' '}
          </span>
        )}
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
        {label && (
          <span className={`tree-key ${isProtoLabel ? 'tree-proto-key' : ''}`}>
            {label}:{' '}
          </span>
        )}
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
          {value.__type === 'array' && (
            <>
              {value.isPrototype && value.keys
                ? value.keys.map((key, i) => (
                    <ObjectTree key={key} value={value.values![i]} depth={depth + 1} label={key} onSelectLine={onSelectLine} />
                  ))
                : value.items.map((item, i) => (
                    <ObjectTree key={i} value={item} depth={depth + 1} label={String(i)} onSelectLine={onSelectLine} />
                  ))}
              {value.proto && (
                <ObjectTree value={value.proto} depth={depth + 1} label="[[Prototype]]" onSelectLine={onSelectLine} />
              )}
            </>
          )}

          {value.__type === 'object' && (
            <>
              {value.keys.map((key, i) => (
                <ObjectTree key={key} value={value.values[i]} depth={depth + 1} label={key} onSelectLine={onSelectLine} />
              ))}
              {value.proto && (
                <ObjectTree value={value.proto} depth={depth + 1} label="[[Prototype]]" onSelectLine={onSelectLine} />
              )}
            </>
          )}

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
