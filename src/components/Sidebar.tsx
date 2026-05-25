import { useState, useRef, useEffect } from 'react';
import {
  Box,
  ChevronDown,
  ArrowRight,
  X,
  PanelLeftClose,
  ChevronRight,
  Clock,
  CheckSquare,
  Archive,
  Eye,
  EyeOff,
  ArrowDownWideNarrow,
  Check,
} from 'lucide-react';
import { FileExplorer } from './FileExplorer';
import { CreateFileButton } from './CreateFile';
import { TableOfContents } from './TableOfContents';
import { BacklinksPanel } from './BacklinksPanel';
import { OutgoingLinksPanel } from './OutgoingLinksPanel';
import { TagsPanel } from './TagsPanel';
import { AnnotationsPanel } from './AnnotationsPanel';
import { InboxSection } from './InboxSection';
import { useWorkspaceStore, type SortMode } from '../store/workspace';

export function Sidebar() {
  const vaultPath = useWorkspaceStore((s: { vaultPath: string | null }) => s.vaultPath);
  const {
    recentFiles,
    openFile,
    sortMode,
    setSortMode,
    foldersFirst,
    setFoldersFirst,
    toggleSidebar,
    closeVault,
  } = useWorkspaceStore();
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
              <Box size={10} className="text-accent" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-medium text-primary truncate max-w-28">{vaultName}</span>
            <ChevronDown size={8} className="text-muted" strokeWidth={1.5} />
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
                <ArrowRight size={11} strokeWidth={1.5} />
                Switch Workspace
              </button>
              <button
                onClick={() => {
                  closeVault();
                  setShowVaultMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-secondary hover:text-primary hover:bg-surface-2 flex items-center gap-2"
              >
                <X size={11} strokeWidth={1.5} />
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
            <PanelLeftClose size={14} strokeWidth={1.5} />
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
              <ChevronRight
                size={10}
                strokeWidth={1.5}
                className={`transition-transform duration-150 ${filesExpanded ? 'rotate-90' : ''}`}
              />
              Files
            </button>
            <div className="flex items-center gap-1">
              <SortButton
                mode={sortMode}
                onChange={setSortMode}
                foldersFirst={foldersFirst}
                onFoldersFirstChange={setFoldersFirst}
              />
              <button
                onClick={() => setShowRecent(!showRecent)}
                className={`p-1 rounded hover:bg-surface-2 transition-colors ${showRecent ? 'text-accent' : 'text-muted hover:text-secondary'}`}
                title="Recent files"
              >
                <Clock size={12} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setIsSelectMode(!isSelectMode)}
                className={`p-1 rounded hover:bg-surface-2 transition-colors ${isSelectMode ? 'text-accent' : 'text-muted hover:text-secondary'}`}
                title={isSelectMode ? 'Exit select mode' : 'Select to move'}
              >
                <CheckSquare size={12} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setShowArchive(!showArchive)}
                className={`p-1 rounded hover:bg-surface-2 transition-colors ${showArchive ? 'text-accent' : 'text-muted hover:text-secondary'}`}
                title={showArchive ? 'Hide archive' : 'Show archive'}
              >
                <Archive size={12} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setShowHidden(!showHidden)}
                className={`p-1 rounded hover:bg-surface-2 transition-colors ${showHidden ? 'text-accent' : 'text-muted hover:text-secondary'}`}
                title={showHidden ? 'Hide hidden items' : 'Show hidden items'}
              >
                {showHidden ? (
                  <Eye size={12} strokeWidth={1.5} />
                ) : (
                  <EyeOff size={12} strokeWidth={1.5} />
                )}
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

        {/* Outgoing Links */}
        <OutgoingLinksPanel />

        {/* Backlinks */}
        <BacklinksPanel />

        {/* Notes/Annotations (only for md files) */}
        <AnnotationsPanel />

        {/* Outline (only for md files) */}
        <TableOfContents />
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
        <ChevronRight
          size={10}
          strokeWidth={1.5}
          className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        />
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
                  <X size={10} strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortButton({
  mode,
  onChange,
  foldersFirst,
  onFoldersFirstChange,
}: {
  mode: SortMode;
  onChange: (m: SortMode) => void;
  foldersFirst: boolean;
  onFoldersFirstChange: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const options: { value: SortMode; label: string; icon: string }[] = [
    { value: 'name', label: 'Name', icon: 'A' },
    { value: 'type', label: 'Type', icon: 'T' },
    { value: 'date', label: 'Date', icon: 'D' },
    { value: 'recent', label: 'Recent', icon: 'R' },
  ];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded hover:bg-surface-2 text-muted hover:text-secondary transition-colors"
        title={`Sort: ${options.find((o) => o.value === mode)?.label}`}
      >
        <ArrowDownWideNarrow size={12} strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface-1 border border-default rounded-lg shadow-xl z-50 py-1 w-40">
          <div className="px-2.5 py-1 text-[10px] font-medium text-muted uppercase tracking-wider">
            Sort by
          </div>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-2 hover:bg-surface-2 ${
                mode === opt.value ? 'text-accent' : 'text-secondary'
              }`}
            >
              <span className="w-4 text-center shrink-0">
                {mode === opt.value && <Check size={10} strokeWidth={1.5} />}
              </span>
              {opt.label}
            </button>
          ))}
          <div className="border-t border-default my-1" />
          <button
            onClick={() => onFoldersFirstChange(!foldersFirst)}
            className="w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-2 hover:bg-surface-2 text-secondary"
          >
            <span className="w-4 text-center shrink-0">
              {foldersFirst && <Check size={10} strokeWidth={1.5} />}
            </span>
            Folders first
          </button>
        </div>
      )}
    </div>
  );
}
