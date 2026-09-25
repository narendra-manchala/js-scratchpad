import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

export interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
}

function fuzzyMatch(query: string, label: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  // Simple substring match + fuzzy char-by-char
  if (l.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < l.length && qi < q.length; i++) {
    if (l[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo(() => {
    return commands.filter(c => fuzzyMatch(query, c.label) || fuzzyMatch(query, c.group));
  }, [commands, query]);

  // Clamp activeIdx
  useEffect(() => {
    setActiveIdx(i => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const execute = useCallback((cmd: PaletteCommand) => {
    onClose();
    cmd.action();
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIdx]) execute(filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, activeIdx, execute, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  // Group consecutive items
  const groups: Record<string, PaletteCommand[]> = {};
  filtered.forEach(cmd => {
    (groups[cmd.group] ??= []).push(cmd);
  });

  let globalIdx = 0;

  return (
    <>
      <div className="palette-overlay" onClick={onClose} />
      <div className="palette-modal" role="dialog" aria-label="Command palette">
        <div className="palette-input-wrap">
          <svg className="palette-search-icon" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04zm-5.96-1.19a4.5 4.5 0 1 0 6.364-6.364 4.5 4.5 0 0 0-6.364 6.364z"/>
          </svg>
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Type a command…"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="palette-esc-hint">Esc</kbd>
        </div>

        <div className="palette-list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="palette-empty">No commands match "{query}"</div>
          )}
          {Object.entries(groups).map(([group, cmds]) => (
            <div key={group}>
              <div className="palette-group-label">{group}</div>
              {cmds.map(cmd => {
                const idx = globalIdx++;
                return (
                  <div
                    key={cmd.id}
                    className={`palette-item ${idx === activeIdx ? 'palette-item-active' : ''}`}
                    data-idx={idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => execute(cmd)}
                  >
                    <span className="palette-item-label">{cmd.label}</span>
                    {cmd.shortcut && <kbd className="palette-item-shortcut">{cmd.shortcut}</kbd>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
