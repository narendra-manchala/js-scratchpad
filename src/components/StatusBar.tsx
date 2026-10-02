import React, { useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '../lib/detectFileType';
import type { AtaState } from '../lib/ata';

interface StatusBarProps {
  line: number;
  col: number;
  charCount: number;
  saveStatus: 'saved' | 'saving';
  filename: string;
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onAutoDetect: () => void;
  ataState?: AtaState;
}

const LANGUAGE_LABELS: Record<SupportedLanguage, { label: string; ext: string }> = {
  javascript: { label: 'JavaScript', ext: '.js' },
  typescript: { label: 'TypeScript', ext: '.ts' },
  json: { label: 'JSON', ext: '.json' },
};

export function StatusBar({
  line,
  col,
  charCount,
  saveStatus,
  filename,
  language,
  onLanguageChange,
  onAutoDetect,
  ataState,
}: StatusBarProps) {
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showLangMenu) return;
    const handler = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [showLangMenu]);

  const currentLangInfo = LANGUAGE_LABELS[language] || LANGUAGE_LABELS.javascript;

  return (
    <div className="status-bar" role="status" aria-label="Editor status">
      <span className="status-item status-file">{filename}</span>
      <span className="status-sep" />
      <span className="status-item">Ln {line}, Col {col}</span>
      <span className="status-sep" />
      <span className="status-item">{charCount.toLocaleString()} chars</span>
      <span className="status-sep" />

      {/* Language switcher dropdown */}
      <div className="status-lang-wrapper" ref={langMenuRef}>
        <button
          className="status-item status-lang-btn"
          onClick={() => setShowLangMenu(v => !v)}
          title="Select language mode or auto-detect from code"
        >
          <span className={`status-lang-badge status-lang-${language}`}>{currentLangInfo.ext}</span>
          <span>{currentLangInfo.label}</span>
          <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
            <path d="M4.427 6.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427z"/>
          </svg>
        </button>

        {showLangMenu && (
          <div className="status-lang-menu">
            <div className="status-lang-menu-header">Select Language</div>
            {(['javascript', 'typescript', 'json'] as SupportedLanguage[]).map(lang => (
              <button
                key={lang}
                className={`status-lang-option ${language === lang ? 'active' : ''}`}
                onClick={() => {
                  onLanguageChange(lang);
                  setShowLangMenu(false);
                }}
              >
                <span className={`status-lang-badge status-lang-${lang}`}>{LANGUAGE_LABELS[lang].ext}</span>
                <span>{LANGUAGE_LABELS[lang].label}</span>
                {language === lang && <span className="check-mark">✓</span>}
              </button>
            ))}
            <div className="status-lang-divider" />
            <button
              className="status-lang-option status-lang-autodetect"
              onClick={() => {
                onAutoDetect();
                setShowLangMenu(false);
              }}
              title="Analyze code to automatically detect JS, TS, or JSON"
            >
              <span className="autodetect-sparkle">✨</span>
              <span>Auto-detect from Code</span>
            </button>
          </div>
        )}
      </div>

      {/* ATA status */}
      {ataState && ataState.status !== 'idle' && (
        <>
          <span className="status-sep" />
          <span className={`status-item status-ata status-ata-${ataState.status}`} title="Automatic Type Acquisition">
            {ataState.status === 'fetching' ? (
              <>
                <span className="status-ata-dot fetching" />
                <span>Types: {ataState.pkg}…</span>
              </>
            ) : ataState.status === 'loaded' ? (
              <>
                <span className="status-ata-dot loaded" />
                <span>⚡ {ataState.pkg} types ready</span>
              </>
            ) : (
              <span>⚠️ Types failed: {ataState.pkg}</span>
            )}
          </span>
        </>
      )}

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
