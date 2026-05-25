import { useState, useRef, useEffect } from 'react';
import { FileExplorer } from './FileExplorer';
import { CreateFileButton } from './CreateFile';
import { TableOfContents } from './TableOfContents';
import { BacklinksPanel } from './BacklinksPanel';
import { TagsPanel } from './TagsPanel';
import { AnnotationsPanel } from './AnnotationsPanel';
import { InboxSection } from './InboxSection';
import { useWorkspaceStore, type SortMode } from '../store/workspace';

export function Sidebar() {
  const vaultPath = useWorkspaceStore((s: { vaultPath: string | null }) => s.vaultPath);
  const { recentFiles, openFile, sortMode, setSortMode, toggleSidebar, closeVault } =
    useWorkspaceStore();
  const vaultName = vaultPath ? vaultPath.split('/').pop() : 'Vault';
  const [showRecent, setShowRecent] = useState(false);
  const [showVaultMenu, setShowVaultMenu] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const vaultMenuRef = useRef<HTMLDivElement>(null);

  // Close vault menu on outside click
  useEffect(() => {
    if (!showVaultMenu) return;
    const handler = (e: MouseEvent) => {
      if (vaultMenuRef.current && !vaultMenuRef.current.contains(e.target as Node)) {
        setShowVaultMenu(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowVaultMenu(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [showVaultMenu]);

  return (
    <aside className="h-full flex flex-col bg-surface-1">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="relative flex items-center gap-2">
          <button
            onClick={() => setShowVaultMenu(!showVaultMenu)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="Workspace options"
          >
            <div className="w-5 h-5 rounded bg-accent-glow flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M1 2.5L5 1l4 1.5v5L5 9 1 7.5v-5z"
                  stroke="var(--color-accent)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
                <path
                  d="M1 2.5L5 4l4-1.5M5 4v5"
                  stroke="var(--color-accent)"
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-primary truncate max-w-28">{vaultName}</span>
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-muted"
            >
              <path d="M2 3l2 2 2-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Vault/workspace menu */}
          {showVaultMenu && (
            <div
              ref={vaultMenuRef}
              className="absolute top-full left-0 mt-1.5 min-w-48 py-1 rounded-lg bg-surface-1 border border-default shadow-lg z-50"
            >
              <div className="px-3 py-1.5 text-xs text-muted truncate border-b border-default mb-1">
                {vaultPath}
              </div>
              <button
                onClick={() => {
                  closeVault();
                  setShowVaultMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-secondary hover:text-primary hover:bg-surface-2 flex items-center gap-2"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M3 8h7M7 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Switch Workspace
              </button>
              <button
                onClick={() => {
                  closeVault();
                  setShowVaultMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-secondary hover:text-primary hover:bg-surface-2 flex items-center gap-2"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Close Workspace
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <CreateFileButton />
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-surface-2 text-muted hover:text-primary transition-colors"
            title="Collapse sidebar (⌘B)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="1" y="2" width="14" height="12" rx="1.5" />
              <path d="M5 2v12" />
              <path d="M10 7l-2 1.5 2 1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Pinned Files */}
        <PinnedFiles />

        {/* Inbox */}
        <InboxSection />

        {/* Files Section - collapsible */}
        <div className="border-t border-default">
          <div className="flex items-center justify-between px-4 py-2">
            <button
              onClick={() => setFilesExpanded(!filesExpanded)}
              className="flex items-center gap-2 text-xs font-medium text-muted uppercase tracking-wider hover:text-secondary transition-colors"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className={`transition-transform duration-150 ${filesExpanded ? 'rotate-90' : ''}`}
              >
                <path d="M3 1.5l4 3.5-4 3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Files
            </button>
            <div className="flex items-center gap-1">
              <SortButton mode={sortMode} onChange={setSortMode} />
              <button
                onClick={() => setShowRecent(!showRecent)}
                className={`p-1 rounded hover:bg-surface-2 transition-colors ${showRecent ? 'text-accent' : 'text-muted hover:text-secondary'}`}
                title="Recent files"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3l2 2" strokeLinecap="round" />
                </svg>
              </button>
              <button
                onClick={() => setIsSelectMode(!isSelectMode)}
                className={`p-1 rounded hover:bg-surface-2 transition-colors ${isSelectMode ? 'text-accent' : 'text-muted hover:text-secondary'}`}
                title={isSelectMode ? 'Exit select mode' : 'Select to move'}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="2" y="2" width="12" height="12" rx="2" />
                  <path d="M5 8l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => setShowArchive(!showArchive)}
                className={`p-1 rounded hover:bg-surface-2 transition-colors ${showArchive ? 'text-accent' : 'text-muted hover:text-secondary'}`}
                title={showArchive ? 'Hide archive' : 'Show archive'}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
              </button>
              <button
                onClick={() => setShowHidden(!showHidden)}
                className={`p-1 rounded hover:bg-surface-2 transition-colors ${showHidden ? 'text-accent' : 'text-muted hover:text-secondary'}`}
                title={showHidden ? 'Hide hidden items' : 'Show hidden items'}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  {showHidden ? (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  ) : (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {filesExpanded && (
            <>
              {showRecent && recentFiles.length > 0 && (
                <div className="px-2 pb-2">
                  <div className="px-2 py-1 text-xs text-muted">Recent</div>
                  {recentFiles.slice(0, 8).map((path) => {
                    const name = path.split('/').pop() ?? path;
                    return (
                      <button
                        key={path}
                        onClick={() => openFile(path)}
                        className="w-full text-left px-2 py-1 rounded text-xs text-secondary hover:bg-surface-2 hover:text-primary truncate"
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="px-2 pb-2">
                <FileExplorer
                  showArchive={showArchive}
                  showHidden={showHidden}
                  isSelectMode={isSelectMode}
                  onEnterSelectMode={() => setIsSelectMode(true)}
                  onExitSelectMode={() => setIsSelectMode(false)}
                />
              </div>
            </>
          )}
        </div>

        {/* Tags */}
        <TagsPanel />

        {/* Notes/Annotations (only for md files) */}
        <AnnotationsPanel />

        {/* Outline (only for md files) */}
        <TableOfContents />

        {/* Backlinks (only for md files) */}
        <BacklinksPanel />
      </div>
    </aside>
  );
}

function PinnedFiles() {
  const { pinnedFiles, openFile, togglePin } = useWorkspaceStore();
  const [expanded, setExpanded] = useState(true);

  if (pinnedFiles.length === 0) return null;

  return (
    <div className="border-t border-default">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider hover:text-secondary transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M3 1.5l4 3.5-4 3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Pinned
        <span className="ml-auto px-1.5 py-0.5 rounded bg-surface-2 text-muted font-mono text-xs">
          {pinnedFiles.length}
        </span>
      </button>
      {expanded && (
        <div className="px-2 pb-2">
          {pinnedFiles.map((path) => {
            const name = path.split('/').pop() ?? path;
            return (
              <div key={path} className="group flex items-center">
                <button
                  onClick={() => openFile(path)}
                  className="flex-1 text-left px-2 py-1 rounded text-xs text-secondary hover:bg-surface-2 hover:text-primary truncate"
                >
                  {name}
                </button>
                <button
                  onClick={() => togglePin(path)}
                  className="hidden group-hover:block p-0.5 text-muted hover:text-danger rounded"
                  title="Unpin"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="4" y1="4" x2="12" y2="12" />
                    <line x1="12" y1="4" x2="4" y2="12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortButton({ mode, onChange }: { mode: SortMode; onChange: (m: SortMode) => void }) {
  const [open, setOpen] = useState(false);
  const labels: Record<SortMode, string> = { name: 'Name', type: 'Type', date: 'Date' };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded hover:bg-surface-2 text-muted hover:text-secondary transition-colors"
        title={`Sort: ${labels[mode]}`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 4h12M4 8h8M6 12h4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface-1 border border-default rounded-lg shadow-xl z-50 py-1 w-28">
          {(['name', 'type', 'date'] as SortMode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                onChange(m);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-2 ${mode === m ? 'text-accent' : 'text-secondary'}`}
            >
              {labels[m]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
