import { useWorkspaceStore } from '../store/workspace';

interface StatusBarProps {
  onOpenSettings?: () => void;
  onToggleGit?: () => void;
  onToggleScratchPad?: () => void;
  onQuickNote?: () => void;
  onToggleSearch?: () => void;
  onToggleHelp?: () => void;
  onToggleResources?: () => void;
  gitOpen?: boolean;
  scratchPadOpen?: boolean;
  searchOpen?: boolean;
  helpOpen?: boolean;
  resourcesOpen?: boolean;
}

const FILE_TYPE_LABELS: Record<string, string> = {
  md: 'Markdown',
  excalidraw: 'Drawing',
  mermaid: 'Diagram',
};

const FILE_TYPE_COLORS: Record<string, string> = {
  md: 'var(--color-accent)',
  excalidraw: 'var(--color-warning)',
  mermaid: 'var(--color-success)',
};

export function StatusBar({
  onOpenSettings,
  onToggleGit,
  onToggleScratchPad,
  onQuickNote,
  onToggleSearch,
  onToggleHelp,
  onToggleResources,
  gitOpen,
  scratchPadOpen,
  searchOpen,
  helpOpen,
  resourcesOpen,
}: StatusBarProps) {
  const { openTabs, activeTabId, vaultPath, documentStats } = useWorkspaceStore();
  const activeTab = openTabs.find((tab) => tab.id === activeTabId) ?? null;

  const relativePath =
    activeTab && vaultPath
      ? activeTab.filePath.replace(vaultPath, '').replace(/^\//, '')
      : (activeTab?.filePath ?? null);

  return (
    <div className="h-7 flex-shrink-0 flex items-center justify-between px-3 bg-surface-1 border-t border-default text-xs font-mono select-none">
      <div className="flex items-center gap-3">
        {relativePath && <span className="text-muted truncate max-w-64">{relativePath}</span>}
        {activeTab && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: FILE_TYPE_COLORS[activeTab.fileType] }}
            />
            <span className="text-secondary">{FILE_TYPE_LABELS[activeTab.fileType]}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {documentStats && (
          <span className="flex items-center gap-2.5 text-muted">
            <span>{documentStats.chars.toLocaleString()} chars</span>
            <span className="text-surface-3">|</span>
            <span>{documentStats.words.toLocaleString()} words</span>
            <span className="text-surface-3">|</span>
            <span>~{documentStats.tokens.toLocaleString()} tokens</span>
          </span>
        )}
        {activeTab && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{
                backgroundColor: activeTab.isDirty
                  ? 'var(--color-warning)'
                  : 'var(--color-success)',
              }}
            />
            <span className="text-secondary">{activeTab.isDirty ? 'Modified' : 'Saved'}</span>
          </span>
        )}
        <button
          onClick={onToggleResources}
          className={`p-0.5 rounded transition-colors ${resourcesOpen ? 'text-accent' : 'text-muted hover:text-primary'}`}
          title="Resources"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <rect x="9" y="9" width="6" height="6" />
            <path d="M15 2v2M15 20v2M2 15h2M20 15h2M9 2v2M9 20v2M2 9h2M20 9h2" />
          </svg>
        </button>
        <button
          onClick={onToggleHelp}
          className={`p-0.5 rounded transition-colors ${helpOpen ? 'text-accent' : 'text-muted hover:text-primary'}`}
          title="Help"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
        <button
          onClick={onToggleSearch}
          className={`p-0.5 rounded transition-colors ${searchOpen ? 'text-accent' : 'text-muted hover:text-primary'}`}
          title="Search (⌘⇧F)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
        <button
          onClick={onQuickNote}
          className="p-0.5 rounded text-muted hover:text-primary transition-colors"
          title="Quick Note (⌘⇧N)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
        <button
          onClick={onToggleScratchPad}
          className={`p-0.5 rounded transition-colors ${scratchPadOpen ? 'text-accent' : 'text-muted hover:text-primary'}`}
          title="Scratch Pad (⌘J)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
        </button>
        <button
          onClick={onToggleGit}
          className={`p-0.5 rounded transition-colors ${gitOpen ? 'text-accent' : 'text-muted hover:text-primary'}`}
          title="Git Panel (⌘⇧G)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="18" r="3" />
            <circle cx="12" cy="6" r="3" />
            <path d="M12 9v6" />
          </svg>
        </button>
        <button
          onClick={onOpenSettings}
          className="p-0.5 rounded text-muted hover:text-primary transition-colors"
          title="Settings (⌘,)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
