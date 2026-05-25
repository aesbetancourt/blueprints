import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';
import { VaultService, type SearchResult } from '../services/vault';
import { useWorkspaceStore, type FileEntry } from '../store/workspace';

type SearchMode = 'content' | 'filename';

export function SearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('content');
  const [useRegex, setUseRegex] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [fileResults, setFileResults] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showExamples, setShowExamples] = useState(false);
  const { openFile, vaultPath, fileTree } = useWorkspaceStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Flatten file tree for filename search
  const allFiles = useMemo(() => {
    const flat: FileEntry[] = [];
    const walk = (nodes: FileEntry[]) => {
      for (const node of nodes) {
        flat.push(node);
        if (node.children) walk(node.children);
      }
    };
    walk(fileTree);
    return flat;
  }, [fileTree]);

  // Content search
  const doContentSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || q.length < 2) {
        setResults([]);
        return;
      }

      if (useRegex) {
        try {
          new RegExp(q);
          setRegexError(null);
        } catch (err) {
          setRegexError((err as Error).message);
          setResults([]);
          return;
        }
      }

      setLoading(true);
      try {
        const r = await VaultService.searchFiles(q);
        // If regex mode, filter results client-side with regex
        if (useRegex) {
          const re = new RegExp(q, 'i');
          setResults(r.filter((item) => re.test(item.line_content)));
        } else {
          setResults(r);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [useRegex],
  );

  // Filename search (client-side filtering)
  const doFileSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setFileResults([]);
        return;
      }

      if (useRegex) {
        try {
          const re = new RegExp(q, 'i');
          setRegexError(null);
          setFileResults(allFiles.filter((f) => re.test(f.name)));
        } catch (err) {
          setRegexError((err as Error).message);
          setFileResults([]);
        }
      } else {
        const lower = q.toLowerCase();
        setFileResults(allFiles.filter((f) => f.name.toLowerCase().includes(lower)));
      }
    },
    [allFiles, useRegex],
  );

  // Debounced search
  useEffect(() => {
    setSelectedIndex(0);
    if (mode === 'content') {
      const timer = setTimeout(() => doContentSearch(query), 250);
      return () => clearTimeout(timer);
    } else {
      doFileSearch(query);
    }
  }, [query, mode, doContentSearch, doFileSearch]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setFileResults([]);
      setSelectedIndex(0);
      setRegexError(null);
      setShowExamples(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const getRelative = (p: string) => {
    if (!vaultPath) return p;
    return p.startsWith(vaultPath) ? p.slice(vaultPath.length + 1) : p;
  };

  const currentResults = mode === 'content' ? results : fileResults;
  const resultCount = currentResults.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, resultCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'content' && results[selectedIndex]) {
        openFile(results[selectedIndex].path);
        onClose();
      } else if (mode === 'filename' && fileResults[selectedIndex]) {
        openFile(fileResults[selectedIndex].path);
        onClose();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setMode((m) => (m === 'content' ? 'filename' : 'content'));
    }
  };

  const regexExamples = [
    { pattern: '\\bTODO\\b', desc: 'Match whole word TODO' },
    { pattern: 'import.*from', desc: 'Lines with import...from' },
    { pattern: '^#{1,3}\\s', desc: 'Markdown headings (h1-h3)' },
    { pattern: '\\[.*\\]\\(.*\\)', desc: 'Markdown links' },
    { pattern: '(?:bug|fix|issue)', desc: 'Match bug, fix, or issue' },
    { pattern: '\\d{4}-\\d{2}-\\d{2}', desc: 'Dates (YYYY-MM-DD)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-default bg-surface-1 shadow-2xl overflow-hidden">
        {/* Mode tabs */}
        <div className="flex items-center gap-0 border-b border-default bg-surface-0">
          <button
            onClick={() => setMode('content')}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
              mode === 'content'
                ? 'text-accent border-accent'
                : 'text-muted hover:text-secondary border-transparent'
            }`}
          >
            Content
          </button>
          <button
            onClick={() => setMode('filename')}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
              mode === 'filename'
                ? 'text-accent border-accent'
                : 'text-muted hover:text-secondary border-transparent'
            }`}
          >
            File Name
          </button>
          <div className="ml-auto flex items-center gap-2 pr-3">
            <button
              onClick={() => setShowExamples(!showExamples)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${showExamples ? 'text-accent bg-accent-glow' : 'text-muted hover:text-secondary'}`}
              title="Regex examples"
            >
              ?
            </button>
            <button
              onClick={() => {
                setUseRegex(!useRegex);
                setRegexError(null);
              }}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${useRegex ? 'text-accent bg-accent-glow' : 'text-muted hover:text-secondary hover:bg-surface-2'}`}
              title="Toggle regex mode"
            >
              .*
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="flex items-center px-4 border-b border-default">
          <Search size={14} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === 'content'
                ? useRegex
                  ? 'Regex pattern to search in file contents...'
                  : 'Search text in file contents...'
                : useRegex
                  ? 'Regex pattern to match file names...'
                  : 'Search by file name...'
            }
            className="flex-1 px-3 py-3 bg-transparent text-primary placeholder-[var(--color-text-muted)] outline-none text-sm font-mono"
            autoFocus
            onKeyDown={handleKeyDown}
          />
          {loading && <span className="text-xs text-muted animate-pulse">Searching...</span>}
          {resultCount > 0 && !loading && (
            <span className="text-xs text-muted">
              {resultCount} result{resultCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Regex error */}
        {regexError && (
          <div className="px-4 py-2 bg-danger/10 border-b border-danger/30 text-xs text-danger">
            Invalid regex: {regexError}
          </div>
        )}

        {/* Regex examples */}
        {showExamples && (
          <div className="px-4 py-3 border-b border-default bg-surface-0">
            <div className="text-xs text-muted mb-2 font-medium">Regex Examples (click to use)</div>
            <div className="grid grid-cols-2 gap-1.5">
              {regexExamples.map((ex) => (
                <button
                  key={ex.pattern}
                  onClick={() => {
                    setQuery(ex.pattern);
                    setUseRegex(true);
                    setShowExamples(false);
                    inputRef.current?.focus();
                  }}
                  className="text-left px-2 py-1.5 rounded bg-surface-1 hover:bg-surface-2 transition-colors group"
                >
                  <code className="text-xs text-accent font-mono">{ex.pattern}</code>
                  <p className="text-xs text-muted mt-0.5">{ex.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {/* Empty state */}
          {query.length >= 2 && resultCount === 0 && !loading && !regexError && (
            <div className="px-4 py-10 text-sm text-muted text-center">No results found.</div>
          )}

          {/* Hint when empty */}
          {query.length < 2 && !showExamples && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-muted mb-2">
                {mode === 'content'
                  ? 'Search inside markdown files for text or patterns.'
                  : 'Find files by name across the workspace.'}
              </p>
              <p className="text-xs text-muted">
                <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-default font-mono">
                  Tab
                </kbd>{' '}
                to switch modes{' · '}
                <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-default font-mono">
                  ↑↓
                </kbd>{' '}
                to navigate{' · '}
                <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-default font-mono">
                  Enter
                </kbd>{' '}
                to open
              </p>
            </div>
          )}

          {/* Content search results */}
          {mode === 'content' &&
            results.map((r, i) => (
              <button
                key={`${r.path}-${r.line_number}-${i}`}
                onClick={() => {
                  openFile(r.path);
                  onClose();
                }}
                className={`w-full text-left px-4 py-2.5 flex flex-col gap-0.5 border-b border-subtle transition-colors ${
                  i === selectedIndex ? 'bg-surface-2' : 'hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileTypeDot name={r.name} />
                  <span className="text-xs text-primary truncate font-medium">{r.name}</span>
                  {r.line_number > 0 && (
                    <span className="text-xs text-muted font-mono">:{r.line_number}</span>
                  )}
                  <span className="ml-auto text-xs text-muted truncate max-w-48 font-mono">
                    {getRelative(r.path)}
                  </span>
                </div>
                <p className="text-xs text-secondary truncate pl-4 font-mono">{r.line_content}</p>
              </button>
            ))}

          {/* Filename search results */}
          {mode === 'filename' &&
            fileResults.map((f, i) => (
              <button
                key={f.path}
                onClick={() => {
                  openFile(f.path);
                  onClose();
                }}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-2 border-b border-subtle transition-colors ${
                  i === selectedIndex ? 'bg-surface-2' : 'hover:bg-surface-2'
                }`}
              >
                <FileTypeDot name={f.name} />
                <span className="text-xs text-primary truncate font-medium">{f.name}</span>
                {f.isDirectory && (
                  <span className="text-xs text-muted px-1 py-0 rounded bg-surface-3">folder</span>
                )}
                <span className="ml-auto text-xs text-muted truncate max-w-56 font-mono">
                  {getRelative(f.path)}
                </span>
              </button>
            ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-default bg-surface-0 flex items-center justify-between">
          <span className="text-xs text-muted">
            {useRegex ? 'Regex mode' : 'Text mode'}
            {' · '}
            {mode === 'content' ? 'Searching content' : 'Searching file names'}
          </span>
          <span className="text-xs text-muted">
            <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-default font-mono">
              Esc
            </kbd>{' '}
            to close
          </span>
        </div>
      </div>
    </div>
  );
}

function FileTypeDot({ name }: { name: string }) {
  const ext = name.split('.').pop();
  const colors: Record<string, string> = {
    md: 'var(--color-accent)',
    excalidraw: 'var(--color-warning)',
    mermaid: 'var(--color-success)',
  };
  const color = colors[ext ?? ''] ?? 'var(--color-text-muted)';
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}
