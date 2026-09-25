import React from 'react';

interface StatusBarProps {
  line: number;
  col: number;
  charCount: number;
  saveStatus: 'saved' | 'saving';
  filename: string;
}

export function StatusBar({ line, col, charCount, saveStatus, filename }: StatusBarProps) {
  return (
    <div className="status-bar" role="status" aria-label="Editor status">
      <span className="status-item status-file">{filename}</span>
      <span className="status-sep" />
      <span className="status-item">Ln {line}, Col {col}</span>
      <span className="status-sep" />
      <span className="status-item">{charCount.toLocaleString()} chars</span>
      <span className="status-sep" />
      <span className="status-item">TypeScript</span>
      <div className="status-spacer" />
      <span className={`status-item status-save status-${saveStatus}`}>
        {saveStatus === 'saving' ? (
          <><span className="status-dot saving-dot" />Saving…</>
        ) : (
          <><span className="status-dot saved-dot" />Saved</>
        )}
      </span>
    </div>
  );
}
