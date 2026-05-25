import { useWorkspaceStore, type Tab } from '../store/workspace';

interface BreadcrumbsProps {
  editorMode?: 'rich' | 'raw';
  onEditorModeChange?: (mode: 'rich' | 'raw') => void;
  showModeToggle?: boolean;
}

export function Breadcrumbs({
  editorMode = 'rich',
  onEditorModeChange,
  showModeToggle,
}: BreadcrumbsProps) {
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const vaultPath = useWorkspaceStore((s) => s.vaultPath);

  const activeTab: Tab | undefined = openTabs.find((t) => t.id === activeTabId);

  if (!activeTab || !vaultPath) return null;

  const relativePath = activeTab.filePath.startsWith(vaultPath)
    ? activeTab.filePath.slice(vaultPath.length).replace(/^\//, '')
    : activeTab.filePath;

  const segments = relativePath.split('/').filter(Boolean);

  return (
    <div className="flex items-center gap-1 bg-surface-1 border-b border-default px-3 py-1.5 text-xs text-muted">
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted">/</span>}
            <span className={isLast ? 'text-secondary' : 'text-muted'}>{segment}</span>
          </span>
        );
      })}

      {showModeToggle && (
        <div className="ml-auto flex items-center rounded-md bg-surface-2 p-0.5">
          <button
            onClick={() => onEditorModeChange?.('rich')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
              editorMode === 'rich'
                ? 'bg-surface-0 text-primary shadow-sm'
                : 'text-muted hover:text-secondary'
            }`}
            title="Rich editor"
          >
            Rich
          </button>
          <button
            onClick={() => onEditorModeChange?.('raw')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
              editorMode === 'raw'
                ? 'bg-surface-0 text-primary shadow-sm'
                : 'text-muted hover:text-secondary'
            }`}
            title="Raw markdown"
          >
            Raw
          </button>
        </div>
      )}
    </div>
  );
}
