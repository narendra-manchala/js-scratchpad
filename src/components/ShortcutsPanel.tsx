import React from 'react';

const GROUPS = [
  {
    label: 'Execution',
    shortcuts: [
      { keys: ['⌘', '↵'], desc: 'Run code' },
      { keys: ['⌘', 'K'], desc: 'Stop execution' },
    ],
  },
  {
    label: 'Editor',
    shortcuts: [
      { keys: ['⌘', '⇧', 'F'], desc: 'Format document' },
      { keys: ['⌘', 'F'], desc: 'Find / search' },
      { keys: ['⌘', 'Z'], desc: 'Undo' },
      { keys: ['⌘', '⇧', 'Z'], desc: 'Redo' },
      { keys: ['⌘', '/'], desc: 'Toggle line comment' },
      { keys: ['Alt', '↑/↓'], desc: 'Move line up / down' },
      { keys: ['⌘', 'D'], desc: 'Select next occurrence' },
    ],
  },
  {
    label: 'Files & Navigation',
    shortcuts: [
      { keys: ['⌘', 'K'], desc: 'Open command palette' },
      { keys: ['⌘', '?'], desc: 'Keyboard shortcuts' },
      { keys: ['Dbl-click'], desc: 'Rename tab' },
      { keys: ['Right-click'], desc: 'Tab context menu' },
    ],
  },
  {
    label: 'Console',
    shortcuts: [
      { keys: ['Click ▸'], desc: 'Expand object tree' },
      { keys: ['Click 📋'], desc: 'Copy entry' },
      { keys: ['◀ ▶'], desc: 'Browse execution history' },
    ],
  },
];

interface ShortcutsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsPanel({ open, onClose }: ShortcutsPanelProps) {
  if (!open) return null;

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="shortcuts-drawer" role="dialog" aria-label="Keyboard shortcuts">
        <div className="shortcuts-header">
          <span>Keyboard Shortcuts</span>
          <button className="panel-close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22z"/>
            </svg>
          </button>
        </div>
        <div className="shortcuts-body">
          {GROUPS.map(g => (
            <div key={g.label} className="shortcuts-group">
              <div className="shortcuts-group-label">{g.label}</div>
              {g.shortcuts.map((s, i) => (
                <div key={i} className="shortcuts-row">
                  <div className="shortcuts-keys">
                    {s.keys.map((k, j) => (
                      <React.Fragment key={j}>
                        <kbd className="shortcut-key">{k}</kbd>
                        {j < s.keys.length - 1 && <span className="key-plus">+</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <span className="shortcuts-desc">{s.desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
