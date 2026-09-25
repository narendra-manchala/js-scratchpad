import React, { useCallback, useEffect, useRef } from 'react';
import type { Settings } from '../lib/settings';
import { DEFAULT_SETTINGS } from '../lib/settings';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (s: Settings) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const FONT_SIZES = [12, 13, 14, 16, 18];
const TAB_SIZES = [2, 4];
const CONSOLE_FONT_SIZES = [11, 12, 12.5, 13, 14];

export function SettingsPanel({ open, onClose, settings, onChange, anchorRef }: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      try {
        if (
          panelRef.current &&
          !panelRef.current.contains(e.target as Node) &&
          (!anchorRef?.current || !anchorRef.current.contains(e.target as Node))
        ) {
          onClose();
        }
      } catch (err) {}
    };
    // Use a small delay so the click that opened the panel doesn't immediately close it
    const timer = setTimeout(() => window.addEventListener('mousedown', handler), 10);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handler);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  // Fallback to default if settings is somehow undefined
  const safeSettings = settings || DEFAULT_SETTINGS;

  const set = (patch: Partial<Settings>) => {
    if (onChange) onChange({ ...safeSettings, ...patch });
  };

  return (
    <div ref={panelRef} className="settings-dropdown" role="dialog" aria-label="Settings">
      <div className="settings-dropdown-title">Settings</div>

      <div className="settings-group">
        <span className="settings-label">Theme</span>
        <div className="settings-options">
          {(['system', 'dark', 'light'] as const).map(t => (
            <button
              key={t}
              className={`opt-btn ${safeSettings.theme === t ? 'opt-active' : ''}`}
              onClick={() => set({ theme: t })}
              style={{ textTransform: 'capitalize' }}
            >{t}</button>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-label">Editor Font</span>
        <div className="settings-options">
          {FONT_SIZES.map(s => (
            <button
              key={s}
              className={`opt-btn ${safeSettings.fontSize === s ? 'opt-active' : ''}`}
              onClick={() => set({ fontSize: s })}
            >{s}px</button>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-label">Tab Size</span>
        <div className="settings-options">
          {TAB_SIZES.map(s => (
            <button
              key={s}
              className={`opt-btn ${safeSettings.tabSize === s ? 'opt-active' : ''}`}
              onClick={() => set({ tabSize: s })}
            >{s} spaces</button>
          ))}
        </div>
      </div>

      <div className="settings-group settings-row">
        <span className="settings-label">Word Wrap</span>
        <button
          className={`toggle-pill ${safeSettings.wordWrap ? 'toggle-on' : ''}`}
          onClick={() => set({ wordWrap: !safeSettings.wordWrap })}
          role="switch"
          aria-checked={safeSettings.wordWrap}
        >
          <span className="toggle-knob" />
        </button>
      </div>

      <div className="settings-group">
        <span className="settings-label">Console Font</span>
        <div className="settings-options">
          {CONSOLE_FONT_SIZES.map(s => (
            <button
              key={s}
              className={`opt-btn ${safeSettings.consoleFontSize === s ? 'opt-active' : ''}`}
              onClick={() => set({ consoleFontSize: s })}
            >{s}px</button>
          ))}
        </div>
      </div>

      <div className="settings-group" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <span className="settings-label">GitHub Personal Access Token (for Gists)</span>
        <input 
          type="password"
          className="settings-input"
          placeholder="ghp_..."
          value={safeSettings.githubToken || ''}
          onChange={e => set({ githubToken: e.target.value })}
          style={{
            width: '100%',
            marginTop: '8px',
            padding: '8px',
            background: 'var(--bg-root)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-code)',
            fontSize: '12px'
          }}
        />
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Required to export files to GitHub Gists. Stored locally.
        </div>
      </div>
    </div>
  );
}
