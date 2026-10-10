import React, { useState, useEffect, useRef } from 'react';

interface PackagesPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  packages: string[];
  onAddPackage: (pkg: string) => void;
  onRemovePackage: (pkg: string) => void;
}

const NPM_ICON = (
  <svg viewBox="0 0 780 250" width="28" height="10" aria-hidden="true">
    <path fill="#CB3837" d="M240,250h100v-50h100V0H240V250z M340,50h50v100h-50V50z" />
    <path fill="#CB3837" d="M0,0v250h100V50h50v200h50V0H0z" />
    <path fill="#CB3837" d="M480,0v250h100V50h50v200h50V50h50v200h50V0H480z" />
  </svg>
);

export function PackagesPanel({ open, onClose, anchorRef, packages, onAddPackage, onRemovePackage }: PackagesPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => window.addEventListener('mousedown', handleDown), 10);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleDown);
    };
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setError('');
    }
  }, [open]);

  function handleDown(e: MouseEvent) {
    if (
      panelRef.current &&
      !panelRef.current.contains(e.target as Node) &&
      !anchorRef.current?.contains(e.target as Node)
    ) {
      onClose();
    }
  }

  function handleAdd() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (packages.includes(trimmed)) {
      setError(`'${trimmed}' is already added.`);
      return;
    }
    onAddPackage(trimmed);
    setInputValue('');
    setError('');
  }

  if (!open) return null;

  return (
    <div ref={panelRef} className="pkg-panel" role="dialog" aria-label="Packages">
      {/* Header */}
      <div className="pkg-panel-header">
        <div className="pkg-panel-header-left">
          <div className="pkg-panel-icon">{NPM_ICON}</div>
          <div>
            <div className="pkg-panel-title">Packages</div>
            <div className="pkg-panel-subtitle">Add npm packages to your scratchpad</div>
          </div>
        </div>
        <button className="pkg-panel-close" onClick={onClose} title="Close" aria-label="Close">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path fillRule="evenodd" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
          </svg>
        </button>
      </div>

      {/* Input row */}
      <div className="pkg-panel-body">
        <div className="pkg-input-row">
          <div className="pkg-input-wrap">
            <svg className="pkg-input-icon" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
              <path d="M7 1.5C3.96 1.5 1.5 3.96 1.5 7S3.96 12.5 7 12.5 12.5 10.04 12.5 7 10.04 1.5 7 1.5zM0 7a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 0 7z" />
            </svg>
            <input
              ref={inputRef}
              id="pkg-input"
              type="text"
              className="pkg-input"
              value={inputValue}
              onChange={e => { setInputValue(e.target.value); setError(''); }}
              placeholder="lodash, date-fns, zod@3..."
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            className="pkg-add-btn"
            onClick={handleAdd}
            disabled={!inputValue.trim()}
            title="Add package (Enter)"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path fillRule="evenodd" d="M8 1.5a.75.75 0 0 1 .75.75v5h5a.75.75 0 0 1 0 1.5h-5v5a.75.75 0 0 1-1.5 0v-5h-5a.75.75 0 0 1 0-1.5h5v-5A.75.75 0 0 1 8 1.5z" />
            </svg>
            Add
          </button>
        </div>

        {error && (
          <div className="pkg-error">
            <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7.25 4.75a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4zm.75 7.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
            </svg>
            {error}
          </div>
        )}

        {/* Package list */}
        <div className="pkg-list-header">
          <span>Installed</span>
          <span className="pkg-count">{packages.length}</span>
        </div>

        <ul className="pkg-list" aria-label="Installed packages">
          {packages.length === 0 ? (
            <li className="pkg-empty">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <span>No packages installed</span>
              <span className="pkg-empty-hint">Type a package name above and press Enter</span>
            </li>
          ) : (
            packages.map(pkg => {
              const hasVersion = pkg.includes('@') && !pkg.startsWith('@');
              const atIdx = pkg.indexOf('@');
              const name = hasVersion ? pkg.slice(0, atIdx) : pkg;
              const version = hasVersion ? pkg.slice(atIdx) : null;

              return (
                <li key={pkg} className="pkg-item">
                  <div className="pkg-item-left">
                    <div className="pkg-item-dot" />
                    <div>
                      <span className="pkg-item-name">{name}</span>
                      {version && <span className="pkg-item-version">{version}</span>}
                    </div>
                  </div>
                  <div className="pkg-item-actions">
                    <a
                      href={`https://www.npmjs.com/package/${name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pkg-item-link"
                      title={`View ${name} on npm`}
                    >
                      <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
                        <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.5 0h2a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0V3.56L8.28 6.78a.75.75 0 0 1-1.06-1.06l3.22-3.22H9.5a.75.75 0 0 1-.75-.75.75.75 0 0 1 .75-.75z" />
                      </svg>
                    </a>
                    <button
                      className="pkg-item-remove"
                      onClick={() => onRemovePackage(pkg)}
                      title={`Remove ${pkg}`}
                      aria-label={`Remove ${pkg}`}
                    >
                      <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
                        <path fillRule="evenodd" d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15z" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className="pkg-panel-footer">
          Packages are fetched from <a href="https://esm.sh" target="_blank" rel="noopener noreferrer">esm.sh</a> at runtime
        </div>
      </div>
    </div>
  );
}
