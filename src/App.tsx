import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor, typescript } from 'monaco-editor';
import JSZip from 'jszip';
import { useCodeRunner, type HistoryEntry } from './hooks/useCodeRunner';
import { ConsoleOutput } from './components/ConsoleOutput';
import { Toolbar } from './components/Toolbar';
import { ResizableSplit } from './components/ResizableSplit';
import { TabBar } from './components/TabBar';
import { StatusBar } from './components/StatusBar';
import { CommandPalette, type PaletteCommand } from './components/CommandPalette';
import { ShortcutsPanel } from './components/ShortcutsPanel';
import { PRESETS, type CodePreset } from './lib/presets';
import { loadTimeout, saveTimeout } from './lib/storage';
import {
  loadFiles, saveFiles, saveFilesNow, createFile, updateFileName, updateFileCode,
  deleteFile, duplicateFile, makeFile, type ScFile,
} from './lib/files';
import { loadSettings, saveSettings, type Settings } from './lib/settings';
import { getShareableUrl, getSharedCodeFromUrl, clearShareUrl } from './lib/share';
import { exportToGist } from './lib/gist';
import { acquireTypes, subscribeAta, type AtaState } from './lib/ata';
import {
  detectFileType,
  getLanguageFromFile,
  getExtFromLanguage,
  replaceFileExtension,
  type SupportedLanguage,
} from './lib/detectFileType';

declare global {
  interface Window {
    _ataTimer: ReturnType<typeof setTimeout>;
  }
}

const isMac = navigator.platform.toUpperCase().includes('MAC') || navigator.userAgent.includes('Mac');

// ── Monaco base options (overridden by settings) ────────────────────────────
const BASE_MONACO_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontLigatures: true,
  minimap: { enabled: false },
  lineNumbers: 'on',
  bracketPairColorization: { enabled: true },
  automaticLayout: true,
  scrollBeyondLastLine: false,
  padding: { top: 16, bottom: 16 },
  insertSpaces: true,
  renderLineHighlight: 'gutter',
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  suggest: { preview: true },
  inlineSuggest: { enabled: true },
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
};

export default function App() {
  // ── Files ───────────────────────────────────────────────────────────────────
  const initialFiles = useMemo(() => {
    const sharedCode = getSharedCodeFromUrl();
    const loaded = loadFiles();
    if (sharedCode) {
      const sharedFile = makeFile('shared.ts', sharedCode);
      clearShareUrl();
      return [sharedFile, ...loaded];
    }
    return loaded;
  }, []);

  const [files, setFiles] = useState<ScFile[]>(initialFiles);
  const [activeId, setActiveId] = useState<string>(initialFiles[0].id);

  // ── Settings ────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const handleSettingsChange = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
    editorRef.current?.updateOptions({
      fontSize: s.fontSize,
      tabSize: s.tabSize,
      wordWrap: s.wordWrap ? 'on' : 'off',
    });
  }, []);

  // ── Timeout ─────────────────────────────────────────────────────────────────
  const [timeoutMs, setTimeoutMs] = useState(() => loadTimeout() ?? 3000);
  const handleTimeoutChange = useCallback((ms: number) => {
    setTimeoutMs(ms);
    saveTimeout(ms);
  }, []);

  // ── Auto-run ────────────────────────────────────────────────────────────────
  const [autoRun, setAutoRun] = useState(false);
  const autoRunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showPalette, setShowPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [gistStatus, setGistStatus] = useState<'idle' | 'exporting' | 'copied' | 'error'>('idle');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [charCount, setCharCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [ataState, setAtaState] = useState<AtaState>({ status: 'idle' });

  // ── Execution history ────────────────────────────────────────────────────────
  const [runHistory, setRunHistory] = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // ── Runner ──────────────────────────────────────────────────────────────────
  const { entries, isRunning, execTime, runCode, clearConsole, stopCode } = useCodeRunner();

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const update = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    update(mql);
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // ── Editor refs ─────────────────────────────────────────────────────────────
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const modelMapRef = useRef<Map<string, editor.ITextModel>>(new Map());
  const errorDecorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const autoRunRef = useRef(autoRun);
  const runCodeRef = useRef(runCode);
  const timeoutMsRef = useRef(timeoutMs);
  const activeIdRef = useRef(activeId);
  const filesRef = useRef(files);
  const handleRunRef = useRef<(onlySelection?: boolean) => void>(() => {});
  const handleSaveRef = useRef<() => void>(() => {});

  useEffect(() => { autoRunRef.current = autoRun; }, [autoRun]);
  useEffect(() => { runCodeRef.current = runCode; }, [runCode]);
  useEffect(() => { timeoutMsRef.current = timeoutMs; }, [timeoutMs]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { filesRef.current = files; }, [files]);

  // Subscribe to ATA updates
  useEffect(() => subscribeAta(setAtaState), []);

  // ── Save files (debounced) ───────────────────────────────────────────────────
  useEffect(() => {
    setSaveStatus('saving');
    const t = setTimeout(() => {
      saveFiles(files, 0);
      setSaveStatus('saved');
    }, 600);
    return () => clearTimeout(t);
  }, [files]);

  // ── History: record completed runs ──────────────────────────────────────────
  const prevRunningRef = useRef(false);
  useEffect(() => {
    if (prevRunningRef.current && !isRunning && (entries.length > 0 || execTime !== null)) {
      const activeFile = filesRef.current.find(f => f.id === activeIdRef.current);
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        filename: activeFile?.name ?? 'unknown',
        entries: [...entries],
        execTime: execTime ?? 0,
      };
      setRunHistory(prev => [entry, ...prev].slice(0, 20));
      setHistoryIdx(-1); // return to live view after each run
    }
    prevRunningRef.current = isRunning;
  }, [isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Monaco model helpers ─────────────────────────────────────────────────────
  const getOrCreateModel = useCallback((monaco: Monaco, file: ScFile): editor.ITextModel => {
    const existing = modelMapRef.current.get(file.id);
    if (existing && !existing.isDisposed()) return existing;
    
    const lang = getLanguageFromFile(file.name);
    const ext = getExtFromLanguage(lang);
    
    const uri = monaco.Uri.parse(`file:///${file.id}${ext}`);
    const model = monaco.editor.getModel(uri) || monaco.editor.createModel(file.code, lang, uri);
    modelMapRef.current.set(file.id, model);
    return model;
  }, []);

  // ── Language Switching & Auto-detect ──────────────────────────────────────────
  const handleLanguageChange = useCallback((newLang: SupportedLanguage) => {
    const currentActiveId = activeIdRef.current;
    const cur = filesRef.current.find(f => f.id === currentActiveId);
    if (!cur) return;
    const newName = replaceFileExtension(cur.name, newLang);
    setFiles(prev => updateFileName(prev, currentActiveId, newName));

    const model = modelMapRef.current.get(currentActiveId);
    if (model && monacoRef.current) {
      monacoRef.current.editor.setModelLanguage(model, newLang);
    }
  }, []);

  const handleAutoDetect = useCallback(() => {
    const currentActiveId = activeIdRef.current;
    const cur = filesRef.current.find(f => f.id === currentActiveId);
    const code = editorRef.current?.getValue() ?? cur?.code ?? '';
    const detected = detectFileType(code);
    const targetLang: SupportedLanguage = detected === 'json' ? 'json' : detected === 'ts' ? 'typescript' : 'javascript';
    handleLanguageChange(targetLang);
  }, [handleLanguageChange]);

  // ── Jump to Line on Error ─────────────────────────────────────────────────────
  const handleSelectLine = useCallback((line: number) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();

    if (errorDecorationsRef.current) {
      errorDecorationsRef.current.clear();
    }

    const decs = editor.createDecorationsCollection([
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'monaco-line-highlight-error',
        },
      },
    ]);
    errorDecorationsRef.current = decs;
    setTimeout(() => {
      decs.clear();
    }, 2000);
  }, []);

  const handleEditorMount: OnMount = useCallback((editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;
    const tsDefaults = monacoInstance.languages.typescript.typescriptDefaults.getCompilerOptions();
    const compilerOptions: typescript.CompilerOptions = {
      ...tsDefaults,
      target: monacoInstance.languages.typescript.ScriptTarget.ESNext,
      module: monacoInstance.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monacoInstance.languages.typescript.ModuleResolutionKind.NodeJs,
      allowTopLevelAwait: true,
      noEmit: true,
    };

    monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
    monacoInstance.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);

    // Create models for all files
    filesRef.current.forEach(file => getOrCreateModel(monacoInstance, file));
    editorInstance.setModel(getOrCreateModel(monacoInstance, filesRef.current[0]));
    editorInstance.updateOptions({
      fontSize: settings.fontSize,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap ? 'on' : 'off',
    });

    // Track cursor position
    editorInstance.onDidChangeCursorPosition(e => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });

    // Auto-detect file type on paste
    editorInstance.onDidPaste(() => {
      if (!settings.autoDetectType) return;
      const currentActiveId = activeIdRef.current;
      const curFile = filesRef.current.find(f => f.id === currentActiveId);
      if (!curFile) return;
      const value = editorInstance.getValue();
      const detected = detectFileType(value);
      const targetLang: SupportedLanguage = detected === 'json' ? 'json' : detected === 'ts' ? 'typescript' : 'javascript';
      const curLang = getLanguageFromFile(curFile.name);
      if (targetLang !== curLang && (curFile.name.startsWith('untitled-') || curFile.code.length < 50)) {
        handleLanguageChange(targetLang);
      }
    });

    // Track content changes
    editorInstance.onDidChangeModelContent(() => {
      const value = editorInstance.getValue();
      const currentActiveId = activeIdRef.current;
      setFiles(prev => updateFileCode(prev, currentActiveId, value));
      setCharCount(value.length);

      // Fetch ATA types if JS/TS
      const currentFile = filesRef.current.find(f => f.id === currentActiveId);
      const currentLang = currentFile ? getLanguageFromFile(currentFile.name) : 'javascript';
      if (currentLang !== 'json') {
        if (window._ataTimer) clearTimeout(window._ataTimer);
        window._ataTimer = setTimeout(() => acquireTypes(value), 1000);
      }

      // Auto-run debounce
      if (autoRunRef.current) {
        if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
        autoRunTimerRef.current = setTimeout(() => {
          if (!isRunning) runCodeRef.current(value, timeoutMsRef.current, settings.clearOnRun);
        }, 800);
      }
    });

    // Bind ⌘/Ctrl + Enter (Run all or selection)
    editorInstance.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
      () => {
        handleRunRef.current(false);
      }
    );

    // Bind ⌘/Ctrl + Shift + Enter (Run selection only)
    editorInstance.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.Enter,
      () => {
        handleRunRef.current(true);
      }
    );

    // Bind ⌘/Ctrl + L (Clear console)
    editorInstance.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyL,
      () => {
        clearConsole();
      }
    );

    // Bind ⌘/Ctrl + S (Save & format)
    editorInstance.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => {
        handleSaveRef.current();
      }
    );

    setCharCount(editorInstance.getValue().length);
    editorInstance.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Synchronize Language on Rename ───────────────────────────────────────────
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    const activeFile = files.find(f => f.id === activeId);
    if (!activeFile) return;
    
    const model = modelMapRef.current.get(activeId);
    if (model) {
      const targetLang = getLanguageFromFile(activeFile.name);
      if (model.getLanguageId() !== targetLang) {
        monaco.editor.setModelLanguage(model, targetLang);
      }
    }
  }, [files, activeId]);

  // ── File switching ────────────────────────────────────────────────────────────
  const handleSwitchFile = useCallback((id: string) => {
    if (id === activeIdRef.current) return;
    const monaco = monacoRef.current;
    const editorInstance = editorRef.current;
    const target = filesRef.current.find(f => f.id === id);
    if (!monaco || !editorInstance || !target) return;
    editorInstance.setModel(getOrCreateModel(monaco, target));
    setActiveId(id);
    clearConsole();
    setHistoryIdx(-1);
    setCharCount(editorInstance.getValue().length);
    editorInstance.focus();
  }, [getOrCreateModel, clearConsole]);

  // ── File CRUD ─────────────────────────────────────────────────────────────────
  const handleCreateFile = useCallback(() => {
    const { files: next, newFile } = createFile(filesRef.current);
    setFiles(next);
    if (monacoRef.current) getOrCreateModel(monacoRef.current, newFile);
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    if (monaco && editorInstance) editorInstance.setModel(getOrCreateModel(monaco, newFile));
    setActiveId(newFile.id);
    clearConsole();
    setHistoryIdx(-1);
    editorRef.current?.focus();
  }, [getOrCreateModel, clearConsole]);

  const handleRenameFile = useCallback((id: string, name: string) => {
    setFiles(prev => updateFileName(prev, id, name));
  }, []);

  const handleDeleteFile = useCallback((id: string) => {
    const { files: next, nextActiveId } = deleteFile(filesRef.current, id, activeIdRef.current);
    setFiles(next);
    const model = modelMapRef.current.get(id);
    if (model && !model.isDisposed()) model.dispose();
    modelMapRef.current.delete(id);
    if (id === activeIdRef.current) {
      const target = next.find(f => f.id === nextActiveId);
      const monaco = monacoRef.current;
      const editorInstance = editorRef.current;
      if (monaco && editorInstance && target) editorInstance.setModel(getOrCreateModel(monaco, target));
      clearConsole();
      setHistoryIdx(-1);
    }
    setActiveId(nextActiveId);
  }, [getOrCreateModel, clearConsole]);

  const handleDuplicateFile = useCallback((id: string) => {
    const { files: next, newFile } = duplicateFile(filesRef.current, id);
    setFiles(next);
    if (monacoRef.current) getOrCreateModel(monacoRef.current, newFile);
    const monaco = monacoRef.current;
    const editorInstance = editorRef.current;
    if (monaco && editorInstance) editorInstance.setModel(getOrCreateModel(monaco, newFile));
    setActiveId(newFile.id);
    clearConsole();
    setHistoryIdx(-1);
    editorRef.current?.focus();
  }, [getOrCreateModel, clearConsole]);

  const handleDownloadFile = useCallback((id: string) => {
    const file = filesRef.current.find(f => f.id === id);
    if (!file) return;
    const model = modelMapRef.current.get(id);
    const code = model && !model.isDisposed() ? model.getValue() : file.code;
    const isJson = file.name.endsWith('.json');
    const blob = new Blob([code], { type: isJson ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Toolbar actions ───────────────────────────────────────────────────────────
  const activeFile = files.find(f => f.id === activeId) ?? files[0];

  const handleRun = useCallback((onlySelection = false) => {
    const editor = editorRef.current;
    const currentActiveFile = filesRef.current.find(f => f.id === activeIdRef.current) ?? filesRef.current[0];
    let codeToRun = currentActiveFile.code;

    if (settings.formatOnRun && editor) {
      editor.getAction('editor.action.formatDocument')?.run();
    }

    if (editor) {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const selectedText = editor.getModel()?.getValueInRange(selection);
        if (selectedText && selectedText.trim()) {
          codeToRun = selectedText;
        }
      } else if (!onlySelection) {
        codeToRun = editor.getValue();
      }
    }

    setHistoryIdx(-1);
    runCode(codeToRun, timeoutMs, settings.clearOnRun);
  }, [runCode, timeoutMs, settings.clearOnRun, settings.formatOnRun]);

  useEffect(() => {
    handleRunRef.current = handleRun;
  }, [handleRun]);

  // ── Save & Format Handler ────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (settings.formatOnSave && editorRef.current) {
      try {
        await editorRef.current.getAction('editor.action.formatDocument')?.run();
      } catch {
        // ignore format errors if model is temporarily unavailable
      }
    }
    const editor = editorRef.current;
    if (editor) {
      const value = editor.getValue();
      setFiles(prev => {
        const next = updateFileCode(prev, activeIdRef.current, value);
        saveFilesNow(next);
        return next;
      });
    } else {
      saveFilesNow(filesRef.current);
    }
    setSaveStatus('saved');
  }, [settings.formatOnSave]);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  // ── Global keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveRef.current();
      }
      if (mod && e.key === 'k') { e.preventDefault(); setShowPalette(p => !p); }
      if (mod && (e.key === '/' || e.key === '?')) { e.preventDefault(); setShowShortcuts(p => !p); }
      if (mod && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); clearConsole(); }
      if (mod && (e.key === 'w' || e.key === 'W') && !e.shiftKey) {
        if (filesRef.current.length > 1) {
          e.preventDefault();
          handleDeleteFile(activeIdRef.current);
        }
      }
      if (mod && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (filesRef.current[idx]) {
          e.preventDefault();
          handleSwitchFile(filesRef.current[idx].id);
        }
      }
      if (e.key === 'Escape') { setShowPalette(false); setShowShortcuts(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clearConsole, handleDeleteFile, handleSwitchFile]);

  const handleFormat = useCallback(() => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  }, []);

  const handlePresetSelect = useCallback((preset: CodePreset) => {
    const code = preset.code;
    setFiles(prev => updateFileCode(prev, activeId, code));
    const model = modelMapRef.current.get(activeId);
    if (model && !model.isDisposed()) model.setValue(code);
  }, [activeId]);

  const handleShare = useCallback(async () => {
    const code = editorRef.current?.getValue() ?? activeFile.code;
    const url = getShareableUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('copied');
    } catch {
      setShareStatus('error');
    }
    setTimeout(() => setShareStatus('idle'), 2000);
  }, [activeFile.code]);

  const handleExportGist = useCallback(async () => {
    if (!settings.githubToken) {
      alert("Please enter a GitHub Personal Access Token in Settings first.");
      return;
    }
    setGistStatus('exporting');
    
    // Sync models to filesRef before exporting
    const currentFiles = filesRef.current.map(f => {
      const model = modelMapRef.current.get(f.id);
      return model && !model.isDisposed() ? { ...f, code: model.getValue() } : f;
    });

    try {
      const url = await exportToGist(currentFiles, settings.githubToken);
      await navigator.clipboard.writeText(url);
      setGistStatus('copied');
    } catch (e: any) {
      alert("Export failed: " + e.message);
      setGistStatus('error');
    }
    setTimeout(() => setGistStatus('idle'), 3000);
  }, [settings.githubToken]);

  const handleExportZip = useCallback(async () => {
    const zip = new JSZip();
    for (const file of filesRef.current) {
      const model = modelMapRef.current.get(file.id);
      const code = model && !model.isDisposed() ? model.getValue() : file.code;
      zip.file(file.name, code);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'js-scratchpad.zip'; a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Drag & Drop ───────────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.items?.[0]?.kind === 'file') setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.name.endsWith('.ts') || f.name.endsWith('.js') || f.name.endsWith('.tsx') || f.name.endsWith('.json')
    );
    droppedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = evt => {
        const code = evt.target?.result as string;
        const newFile = makeFile(file.name, code);
        setFiles(prev => {
          const next = [...prev, newFile];
          if (monacoRef.current) getOrCreateModel(monacoRef.current, newFile);
          return next;
        });
        // Switch to first dropped file
        if (droppedFiles.indexOf(file) === 0) {
          const editorInstance = editorRef.current;
          const monaco = monacoRef.current;
          if (monaco && editorInstance) {
            const model = getOrCreateModel(monaco, newFile);
            editorInstance.setModel(model);
          }
          setActiveId(newFile.id);
          clearConsole();
          setHistoryIdx(-1);
        }
      };
      reader.readAsText(file);
    });
  }, [getOrCreateModel, clearConsole]);

  // ── Command palette commands ───────────────────────────────────────────────────
  const paletteCommands = useMemo<PaletteCommand[]>(() => [
    { id: 'run',       label: 'Run Code',                  group: 'Execution', shortcut: `${isMac ? '⌘' : 'Ctrl'}↵`, action: () => handleRun(false) },
    { id: 'run-sel',   label: 'Run Selection Only',        group: 'Execution', shortcut: `${isMac ? '⌘⇧' : 'Ctrl⇧'}↵`, action: () => handleRun(true) },
    { id: 'stop',      label: 'Stop Execution',             group: 'Execution', action: stopCode },
    { id: 'clear',     label: 'Clear Console',              group: 'Console',   shortcut: `${isMac ? '⌘' : 'Ctrl'}L`, action: clearConsole },
    { id: 'save',      label: settings.formatOnSave ? 'Save & Format Document' : 'Save Document', group: 'Editor', shortcut: `${isMac ? '⌘' : 'Ctrl'}S`, action: () => handleSaveRef.current() },
    { id: 'format',    label: 'Format Code',                group: 'Editor',    shortcut: `${isMac ? '⌘⇧' : 'Ctrl⇧'}F`, action: handleFormat },
    { id: 'autodetect', label: 'Detect File Type from Code', group: 'Editor',   action: handleAutoDetect },
    { id: 'lang-js',   label: 'Change Language to JavaScript (.js)', group: 'Editor', action: () => handleLanguageChange('javascript') },
    { id: 'lang-ts',   label: 'Change Language to TypeScript (.ts)', group: 'Editor', action: () => handleLanguageChange('typescript') },
    { id: 'lang-json', label: 'Change Language to JSON (.json)',     group: 'Editor', action: () => handleLanguageChange('json') },
    { id: 'new-file',  label: 'New File',                   group: 'Files',     action: handleCreateFile },
    { id: 'download',  label: 'Download Active File',       group: 'Files',     action: () => handleDownloadFile(activeId) },
    { id: 'share',     label: 'Copy Shareable Link',        group: 'Files',     action: handleShare },
    { id: 'zip',       label: 'Export All Files as ZIP',    group: 'Files',     action: handleExportZip },
    { id: 'autorun',   label: `${autoRun ? 'Disable' : 'Enable'} Auto-Run`, group: 'Editor', action: () => setAutoRun(v => !v) },
    { id: 'clear-on-run', label: `${settings.clearOnRun ? 'Disable' : 'Enable'} Clear on Run`, group: 'Console', action: () => handleSettingsChange({ ...settings, clearOnRun: !settings.clearOnRun }) },
    { id: 'shortcuts', label: 'Keyboard Shortcuts',         group: 'Help',      shortcut: `${isMac ? '⌘' : 'Ctrl'}/`, action: () => setShowShortcuts(true) },
    ...files.map((f, i) => ({ id: `switch-${f.id}`, label: `Switch to ${f.name}`, group: 'Files', shortcut: i < 9 ? `${isMac ? '⌘' : 'Ctrl'}${i + 1}` : undefined, action: () => handleSwitchFile(f.id) })),
    ...PRESETS.map(p => ({ id: `preset-${p.id}`, label: `Load preset: ${p.label}`, group: 'Presets', action: () => handlePresetSelect(p) })),
  ], [files, activeId, autoRun, settings, handleRun, stopCode, handleFormat, clearConsole, handleAutoDetect, handleLanguageChange, handleCreateFile, handleDownloadFile, handleShare, handleExportZip, handleSwitchFile, handlePresetSelect, handleSettingsChange]);

  // ── Editor pane (stable — never remounts) ────────────────────────────────────
  const activeTheme = useMemo(() => {
    if (settings.theme === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return settings.theme;
  }, [settings.theme]);

  const activeLanguage = useMemo(() => getLanguageFromFile(activeFile.name), [activeFile.name]);

  const editorPane = useMemo(() => (
    <div
      className={`editor-pane ${isDragging ? 'editor-drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-overlay-inner">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 16.5v-1A1.5 1.5 0 0 1 5.5 14H9"/><path d="M4 8V6.5A1.5 1.5 0 0 1 5.5 5H9"/><path d="M16.5 14H19a1.5 1.5 0 0 1 1.5 1.5v1"/><path d="M16.5 5H19A1.5 1.5 0 0 1 20.5 6.5V8"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="4" y1="12" x2="20" y2="12"/>
            </svg>
            <p>Drop .ts / .js / .json files here</p>
          </div>
        </div>
      )}
      <div className="editor-wrapper">
        <Editor
          height="100%"
          language={activeLanguage}
          theme={activeTheme === 'light' ? 'vs' : 'vs-dark'}
          options={{
            ...BASE_MONACO_OPTIONS,
            fontSize: settings.fontSize,
            tabSize: settings.tabSize,
            wordWrap: settings.wordWrap ? 'on' : 'off',
            quickSuggestions: settings.autocomplete ? { other: true, comments: true, strings: true } : false,
            suggestOnTriggerCharacters: settings.autocomplete,
            wordBasedSuggestions: settings.autocomplete ? 'allDocuments' : 'off',
            parameterHints: { enabled: settings.autocomplete }
          }}
          onMount={handleEditorMount}
          loading={<div className="editor-loading"><span className="spinner" /><span>Loading editor…</span></div>}
        />
      </div>
    </div>
  ), [isDragging, handleDragOver, handleDragLeave, handleDrop, settings.fontSize, settings.tabSize, settings.wordWrap, settings.autocomplete, activeTheme, activeLanguage, handleEditorMount]);

  useEffect(() => {
    if (activeTheme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
  }, [activeTheme]);

  return (
    <div className={`app ${activeTheme === 'light' ? 'theme-light' : ''}`}>
      <Toolbar
        isRunning={isRunning}
        onRun={() => handleRun(false)}
        onStop={stopCode}
        onClear={clearConsole}
        onFormat={handleFormat}
        onShare={handleShare}
        onExportZip={handleExportZip}
        timeoutMs={timeoutMs}
        onTimeoutChange={handleTimeoutChange}
        presets={PRESETS}
        onPresetSelect={handlePresetSelect}
        isMac={isMac}
        autoRun={autoRun}
        onAutoRunToggle={() => setAutoRun(v => !v)}
        onOpenPalette={() => setShowPalette(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        shareStatus={shareStatus}
        onExportGist={handleExportGist}
        gistStatus={gistStatus}
      />

      <TabBar
        files={files}
        activeId={activeId}
        onSwitch={handleSwitchFile}
        onCreate={handleCreateFile}
        onRename={handleRenameFile}
        onDelete={handleDeleteFile}
        onDuplicate={handleDuplicateFile}
        onDownload={handleDownloadFile}
      />

      <main className="app-main">
        <ResizableSplit
          left={editorPane}
          right={
            <ConsoleOutput
              entries={entries}
              execTime={execTime}
              isRunning={isRunning}
              history={runHistory}
              historyIdx={historyIdx}
              onViewHistory={setHistoryIdx}
              consoleFontSize={settings.consoleFontSize}
              onSelectLine={handleSelectLine}
              onClear={clearConsole}
              clearOnRun={settings.clearOnRun}
              onToggleClearOnRun={() => handleSettingsChange({ ...settings, clearOnRun: !settings.clearOnRun })}
              onClearHistory={() => { setRunHistory([]); setHistoryIdx(-1); }}
              isMobile={isMobile}
              isMobileExpanded={isMobileExpanded}
              onToggleMobileExpand={() => setIsMobileExpanded(e => !e)}
            />
          }
          initialRatio={0.56}
          minLeft={60}
          minRight={240}
          isMobile={isMobile}
          isMobileExpanded={isMobileExpanded}
        />
      </main>

      <StatusBar
        line={cursorPos.line}
        col={cursorPos.col}
        charCount={charCount}
        saveStatus={saveStatus}
        filename={activeFile.name}
        language={activeLanguage}
        onLanguageChange={handleLanguageChange}
        onAutoDetect={handleAutoDetect}
        ataState={ataState}
      />

      <CommandPalette
        open={showPalette}
        onClose={() => setShowPalette(false)}
        commands={paletteCommands}
      />

      <ShortcutsPanel
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}
