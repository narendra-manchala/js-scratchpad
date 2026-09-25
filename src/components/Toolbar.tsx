import React, { useRef, useState } from 'react';
import type { CodePreset } from '../lib/presets';
import type { Settings } from '../lib/settings';
import { SettingsPanel } from './SettingsPanel';

interface ToolbarProps {
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  onClear: () => void;
  onFormat: () => void;
  onShare: () => void;
  onExportZip: () => void;
  timeoutMs: number;
  onTimeoutChange: (ms: number) => void;
  presets: CodePreset[];
  onPresetSelect: (preset: CodePreset) => void;
  isMac: boolean;
  autoRun: boolean;
  onAutoRunToggle: () => void;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
  shareStatus: 'idle' | 'copied' | 'error';
  onExportGist: () => void;
  gistStatus: 'idle' | 'exporting' | 'copied' | 'error';
}

const TIMEOUT_OPTIONS = [
  { label: '1s', value: 1000 },
  { label: '3s', value: 3000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
];

export function Toolbar({
  isRunning, onRun, onStop, onClear, onFormat, onShare, onExportZip,
  timeoutMs, onTimeoutChange, presets, onPresetSelect, isMac,
  autoRun, onAutoRunToggle, onOpenPalette, onOpenShortcuts,
  settings, onSettingsChange, shareStatus, onExportGist, gistStatus,
}: ToolbarProps) {
  const keyHint = isMac ? '⌘↵' : 'Ctrl↵';
  const [showSettings, setShowSettings] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="toolbar">
      {/* Brand */}
      <div className="toolbar-brand">
        <svg className="brand-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" strokeLinejoin="round"/>
        </svg>
        <span className="brand-name">JS Scratchpad</span>
      </div>

      <div className="toolbar-controls">
        {/* Run / Stop */}
        {isRunning ? (
          <button id="btn-stop" className="btn btn-stop" onClick={onStop} title="Stop execution">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
              <rect x="3" y="3" width="10" height="10" rx="1"/>
            </svg>
            <span>Stop</span>
          </button>
        ) : (
          <button id="btn-run" className="btn btn-run" onClick={onRun} title={`Run (${keyHint})`}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
              <polygon points="3 2 13 8 3 14 3 2"/>
            </svg>
            <span>Run</span>
            <kbd className="key-hint">{keyHint}</kbd>
          </button>
        )}

        <div className="toolbar-sep" />

        {/* Preset selector */}
        <div className="toolbar-group">
          <label htmlFor="preset-select" className="control-label">Preset</label>
          <select id="preset-select" className="select" onChange={e => {
            const p = presets.find(p => p.id === e.target.value);
            if (p) onPresetSelect(p);
            e.target.value = '';
          }} defaultValue="">
            <option value="" disabled>Choose…</option>
            {presets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>

        {/* Timeout */}
        <div className="toolbar-group">
          <label htmlFor="timeout-select" className="control-label">Timeout</label>
          <select id="timeout-select" className="select" value={timeoutMs} onChange={e => onTimeoutChange(Number(e.target.value))}>
            {TIMEOUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="toolbar-sep" />

        {/* Auto-run toggle */}
        <button
          id="btn-autorun"
          className={`btn btn-icon-label ${autoRun ? 'btn-active-toggle' : 'btn-secondary'}`}
          onClick={onAutoRunToggle}
          title={autoRun ? 'Auto-run on: disable' : 'Auto-run off: enable'}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
            <path d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8zm7.25-4.25a.75.75 0 0 0-1.5 0V8c0 .414.336.75.75.75h3.25a.75.75 0 0 0 0-1.5H8.25V3.75z"/>
          </svg>
          <span>Auto</span>
          {autoRun && <span className="auto-live-dot" />}
        </button>

        <div className="toolbar-sep" />

        {/* Format */}
        <button id="btn-format" className="btn btn-secondary" onClick={onFormat} disabled={isRunning} title="Format code">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <line x1="2" y1="5" x2="14" y2="5"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="11" x2="12" y2="11"/>
          </svg>
          <span>Format</span>
        </button>

        {/* Clear */}
        <button id="btn-clear" className="btn btn-secondary" onClick={onClear} title="Clear console">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <polyline points="2 4 4 4 14 4"/><path d="M13 4l-1 9H4L3 4"/><path d="M7 7v4M9 7v4"/>
          </svg>
          <span>Clear</span>
        </button>

        <div className="toolbar-sep" />

        {/* Share */}
        <button
          id="btn-share"
          className={`btn btn-icon ${shareStatus === 'copied' ? 'btn-share-copied' : 'btn-secondary'}`}
          onClick={onShare}
          title="Copy shareable link"
        >
          {shareStatus === 'copied'
            ? <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
            : <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M7.775 3.275a.75.75 0 0 0 1.06 1.06l1.25-1.25a2 2 0 1 1 2.83 2.83l-2.5 2.5a2 2 0 0 1-2.83 0 .75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 0 1 0-2.83l2.5-2.5a2 2 0 0 1 2.83 0 .75.75 0 0 0 1.06-1.06 3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1.25-1.25a.75.75 0 0 0-1.06-1.06l-1.25 1.25a2 2 0 0 1-2.83 0z"/></svg>
          }
          <span className="btn-icon-label-sm">{shareStatus === 'copied' ? 'Copied!' : 'Share'}</span>
        </button>

        {/* Export ZIP */}
        <button id="btn-zip" className="btn btn-icon btn-secondary" onClick={onExportZip} title="Export all files as ZIP">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M3.5 1.75v11.5c0 .138.112.25.25.25h3.75a.75.75 0 0 1 0 1.5H3.75A1.75 1.75 0 0 1 2 13.25V1.75C2 .784 2.784 0 3.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v2.586a.75.75 0 0 1-1.5 0V4.75h-2a1.75 1.75 0 0 1-1.75-1.75v-2H3.75a.25.25 0 0 0-.25.25zM8.5 14.6V11a.75.75 0 0 1 1.5 0v3.6l.97-.97a.75.75 0 1 1 1.06 1.06l-2.25 2.25a.75.75 0 0 1-1.06 0L6.47 14.69a.75.75 0 1 1 1.06-1.06l.97.97z"/>
          </svg>
          <span className="btn-icon-label-sm">ZIP</span>
        </button>

        {/* Export Gist */}
        <button 
          id="btn-gist" 
          className={`btn btn-icon ${gistStatus === 'copied' ? 'btn-share-copied' : 'btn-secondary'}`} 
          onClick={onExportGist} 
          title="Export to GitHub Gist"
          disabled={gistStatus === 'exporting'}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span className="btn-icon-label-sm">{gistStatus === 'exporting' ? '...' : gistStatus === 'copied' ? 'Copied' : 'Gist'}</span>
        </button>

        <div className="toolbar-sep" />

        {/* Command Palette */}
        <button id="btn-palette" className="btn btn-icon btn-secondary" onClick={onOpenPalette} title="Command palette (⌘K)">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M0 3.75C0 2.784.784 2 1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25v-8.5zm1.75-.25a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25H1.75zM3 6.25a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 6.25zm2.5 0a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5A.75.75 0 0 1 5.5 6.25zM3 9.25a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 9.25zm2.5 0a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3A.75.75 0 0 1 5.5 9.25z"/>
          </svg>
        </button>

        {/* Shortcuts */}
        <button id="btn-shortcuts" className="btn btn-icon btn-secondary" onClick={onOpenShortcuts} title="Keyboard shortcuts (⌘/)">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M7.25 8.037a.75.75 0 0 0 1.5 0v-.901c.976-.281 1.62-1.246 1.52-2.286a2.134 2.134 0 0 0-2.11-1.85 2.133 2.133 0 0 0-2.134 2.133.75.75 0 0 0 1.5 0 .633.633 0 0 1 .634-.633.634.634 0 0 1 .633.649c-.041.41-.34.606-.543.688zm.75 3.88a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
            <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
          </svg>
        </button>

        {/* Settings */}
        <div style={{ position: 'relative' }}>
          <button
            id="btn-settings"
            ref={settingsBtnRef}
            className={`btn btn-icon btn-secondary ${showSettings ? 'btn-icon-active' : ''}`}
            onClick={() => setShowSettings(s => !s)}
            title="Settings"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.255.019.248.019.496 0 .744-.01.108.04.207.088.255l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.103-.303c-.066-.019-.176-.011-.299.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.212.224l-.288 1.107c-.17.644-.716 1.196-1.459 1.26a8.006 8.006 0 0 1-1.402 0C6.006 15.555 5.46 15.004 5.29 14.36l-.288-1.107c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.049-.048.098-.147.088-.255a6.075 6.075 0 0 1 0-.744c.01-.108-.04-.207-.088-.255l-.815-.806C.635 9.965.43 9.218.746 8.543a7.987 7.987 0 0 1 .704-1.218c.428-.609 1.176-.807 1.82-.63l1.103.303c.066.019.176.011.299-.071.214-.143.437-.272.668-.386.133-.066.194-.158.212-.224l.288-1.107C6.006.645 6.552.095 7.299.03 7.532.01 7.766 0 8 0zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.103-.303c.56-.153 1.112-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.103.303c-.56.153-1.112.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0zM8 5.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5zm0 1.5a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 8 6.75z"/>
            </svg>
          </button>
          <SettingsPanel
            open={showSettings}
            onClose={() => setShowSettings(false)}
            settings={settings}
            onChange={onSettingsChange}
            anchorRef={settingsBtnRef}
          />
        </div>
      </div>
    </header>
  );
}
