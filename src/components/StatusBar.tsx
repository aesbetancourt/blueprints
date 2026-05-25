import {
  Cpu,
  HelpCircle,
  Search,
  PenLine,
  FileText,
  GitCommitVertical,
  Settings,
} from 'lucide-react';
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
  json: '#3b82f6',
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
          <Cpu size={13} />
        </button>
        <button
          onClick={onToggleHelp}
          className={`p-0.5 rounded transition-colors ${helpOpen ? 'text-accent' : 'text-muted hover:text-primary'}`}
          title="Help"
        >
          <HelpCircle size={13} />
        </button>
        <button
          onClick={onToggleSearch}
          className={`p-0.5 rounded transition-colors ${searchOpen ? 'text-accent' : 'text-muted hover:text-primary'}`}
          title="Search (⌘⇧F)"
        >
          <Search size={13} />
        </button>
        <button
          onClick={onQuickNote}
          className="p-0.5 rounded text-muted hover:text-primary transition-colors"
          title="Quick Note (⌘⇧N)"
        >
          <PenLine size={13} />
        </button>
        <button
          onClick={onToggleScratchPad}
          className={`p-0.5 rounded transition-colors ${scratchPadOpen ? 'text-accent' : 'text-muted hover:text-primary'}`}
          title="Scratch Pad (⌘J)"
        >
          <FileText size={13} />
        </button>
        <button
          onClick={onToggleGit}
          className={`p-0.5 rounded transition-colors ${gitOpen ? 'text-accent' : 'text-muted hover:text-primary'}`}
          title="Git Panel (⌘⇧G)"
        >
          <GitCommitVertical size={13} />
        </button>
        <button
          onClick={onOpenSettings}
          className="p-0.5 rounded text-muted hover:text-primary transition-colors"
          title="Settings (⌘,)"
        >
          <Settings size={13} />
        </button>
      </div>
    </div>
  );
}
