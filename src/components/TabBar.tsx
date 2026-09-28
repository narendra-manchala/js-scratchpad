import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as RMouseEvent,
} from 'react';
import type { ScFile } from '../lib/files';

interface TabBarProps {
  files: ScFile[];
  activeId: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDownload: (id: string) => void;
}

interface TabProps {
  file: ScFile;
  isActive: boolean;
  onActivate: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDownload: () => void;
  canDelete: boolean;
}

// ── Single Tab ────────────────────────────────────────────────────────────────
function Tab({
  file,
  isActive,
  onActivate,
  onRename,
  onDelete,
  onDuplicate,
  onDownload,
  canDelete,
}: TabProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null);

  const startEdit = useCallback(() => {
    setDraft(file.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 10);
  }, [file.name]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== file.name) {
      const withExt = (trimmed.endsWith('.ts') || trimmed.endsWith('.js')) ? trimmed : `${trimmed}.js`;
      onRename(withExt);
    }
  }, [draft, file.name, onRename]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
      if (e.key === 'Escape') { setEditing(false); setDraft(file.name); }
    },
    [commitEdit, file.name]
  );

  const handleDoubleClick = useCallback((e: RMouseEvent) => {
    e.stopPropagation();
    startEdit();
  }, [startEdit]);

  const handleContextMenu = useCallback((e: RMouseEvent) => {
    e.preventDefault();
    setCtxPos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!ctxPos) return;
    const handler = () => setCtxPos(null);
    window.addEventListener('click', handler, { once: true });
    return () => window.removeEventListener('click', handler);
  }, [ctxPos]);

  return (
    <>
      <div
        className={`tab ${isActive ? 'tab-active' : ''}`}
        onClick={onActivate}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        role="tab"
        aria-selected={isActive}
        title={file.name}
      >
        {/* File icon */}
        <svg className="tab-icon" viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
          <path d="M9.5 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5.5L9.5 1zm0 1.5L12.5 5.5H9.5V2.5z"/>
        </svg>

        {/* Label or rename input */}
        {editing ? (
          <input
            ref={inputRef}
            className="tab-rename-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="tab-label">{file.name}</span>
        )}

        {/* Close button — visible on hover / active */}
        {canDelete && !editing && (
          <button
            className="tab-close"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            title="Close file"
            aria-label={`Close ${file.name}`}
          >
            <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
              <path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Context menu */}
      {ctxPos && (
        <div
          className="tab-context-menu"
          style={{ top: ctxPos.y, left: ctxPos.x }}
          onClick={e => e.stopPropagation()}
        >
          <button className="ctx-item" onClick={() => { setCtxPos(null); startEdit(); }}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.08-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086zM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.249.249 0 0 0 .108-.064L11.189 6.25z"/></svg>
            Rename
          </button>
          <button className="ctx-item" onClick={() => { setCtxPos(null); onDuplicate(); }}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25v-7.5z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25v-7.5zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25h-7.5z"/></svg>
            Duplicate
          </button>
          <button className="ctx-item" onClick={() => { setCtxPos(null); onDownload(); }}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14H2.75zm4.5-9.19V8.25a.75.75 0 0 0 1.5 0V4.81l1.22 1.22a.75.75 0 1 0 1.06-1.06l-2.5-2.5a.75.75 0 0 0-1.06 0l-2.5 2.5a.75.75 0 1 0 1.06 1.06l1.22-1.22z"/></svg>
            Download .ts
          </button>
          <div className="ctx-sep" />
          <button
            className="ctx-item ctx-item-danger"
            disabled={!canDelete}
            onClick={() => { setCtxPos(null); if (canDelete) onDelete(); }}
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM6.5 1.75v1.25h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25zM4.997 6.5a.75.75 0 1 0-1.493.144L4.916 13.5H3.25a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-1.666l1.412-6.856a.75.75 0 1 0-1.493-.144L9.592 13.5H6.408L4.997 6.5z"/></svg>
            Delete
          </button>
        </div>
      )}
    </>
  );
}

// ── New file inline button ────────────────────────────────────────────────────
function NewFileButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="tab-new-btn tab-new-btn-inline"
      onClick={onClick}
      title="New file"
      aria-label="Create new file"
    >
      <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
        <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/>
      </svg>
    </button>
  );
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────
export function TabBar({
  files,
  activeId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
  onDownload,
}: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view whenever it changes
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeTab = container.querySelector('.tab-active') as HTMLElement | null;
    activeTab?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  // Also scroll to the end when a new file is created (so + button stays visible)
  const prevLengthRef = useRef(files.length);
  useEffect(() => {
    if (files.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
    prevLengthRef.current = files.length;
  }, [files.length]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    e.preventDefault();
    scrollRef.current.scrollLeft += e.deltaY;
  }, []);

  return (
    <div className="tab-bar">
      <div
        className="tab-list"
        ref={scrollRef}
        onWheel={handleWheel}
        role="tablist"
        aria-label="Open files"
      >
        {files.map(file => (
          <Tab
            key={file.id}
            file={file}
            isActive={file.id === activeId}
            onActivate={() => onSwitch(file.id)}
            onRename={name => onRename(file.id, name)}
            onDelete={() => onDelete(file.id)}
            onDuplicate={() => onDuplicate(file.id)}
            onDownload={() => onDownload(file.id)}
            canDelete={files.length > 1}
          />
        ))}

        {/* + button sits right after the last tab, scrolls with them */}
        <NewFileButton onClick={onCreate} />
      </div>
    </div>
  );
}
