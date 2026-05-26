import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Pencil,
  Network,
  Braces,
  File,
  X,
  PanelLeftOpen,
  FileCode,
  Code2,
  FileSpreadsheet,
} from 'lucide-react';
import { useWorkspaceStore, type Tab } from '../store/workspace';
import { confirm } from './ConfirmDialog';

function TabIcon({ fileType }: { fileType: string }) {
  switch (fileType) {
    case 'md':
      return <FileText size={12} className="shrink-0" style={{ color: 'var(--color-accent)' }} />;
    case 'excalidraw':
      return <Pencil size={12} className="shrink-0" style={{ color: 'var(--color-warning)' }} />;
    case 'mermaid':
      return <Network size={12} className="shrink-0" style={{ color: 'var(--color-success)' }} />;
    case 'json':
      return <Braces size={12} className="shrink-0" style={{ color: '#a78bfa' }} />;
    case 'yaml':
      return <FileCode size={12} className="shrink-0" style={{ color: '#f472b6' }} />;
    case 'xml':
      return <Code2 size={12} className="shrink-0" style={{ color: '#fb923c' }} />;
    case 'csv':
      return <FileSpreadsheet size={12} className="shrink-0" style={{ color: '#34d399' }} />;
    default:
      return <File size={12} className="shrink-0" style={{ color: 'var(--color-text-muted)' }} />;
  }
}

interface TabContextMenu {
  tabId: string;
  position: { x: number; y: number };
}

export function TabBar() {
  const {
    openTabs,
    activeTabId,
    setActiveTab,
    closeTab,
    setSplitTab,
    splitTabId,
    closeAllTabs,
    closeOtherTabs,
    closeTabsToRight,
    closeTabsToLeft,
    sidebarCollapsed,
    toggleSidebar,
  } = useWorkspaceStore();

  const [contextMenu, setContextMenu] = useState<TabContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  if (openTabs.length === 0) {
    return (
      <div className="h-10 bg-surface-1 border-b border-default flex items-center">
        {sidebarCollapsed && <SidebarExpandButton onClick={toggleSidebar} />}
      </div>
    );
  }

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ tabId, position: { x: e.clientX, y: e.clientY } });
  };

  const contextTab = contextMenu ? openTabs.find((t) => t.id === contextMenu.tabId) : null;
  const contextTabIdx = contextMenu ? openTabs.findIndex((t) => t.id === contextMenu.tabId) : -1;

  return (
    <div className="relative h-10 bg-surface-1 border-b border-default flex items-end overflow-x-auto">
      {sidebarCollapsed && <SidebarExpandButton onClick={toggleSidebar} />}
      {openTabs.map((tab: Tab) => {
        const isActive = tab.id === activeTabId;
        const isSplit = tab.id === splitTabId;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            className={`group relative h-full px-4 flex items-center gap-2 text-xs shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-secondary hover:text-primary'}`}
          >
            {/* Active indicator */}
            {isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-accent" />
            )}
            {/* Split indicator */}
            {isSplit && !isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-surface-3" />
            )}
            <TabIcon fileType={tab.fileType} />
            <span className="max-w-28 truncate">{tab.fileName}</span>
            {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
            <span
              role="button"
              onClick={async (e) => {
                e.stopPropagation();
                if (tab.isDirty) {
                  const confirmed = await confirm({
                    title: 'Unsaved Changes',
                    message: 'This file has unsaved changes. Discard them?',
                    confirmLabel: 'Discard',
                    danger: true,
                  });
                  if (!confirmed) return;
                }
                closeTab(tab.id);
              }}
              className="ml-0.5 w-4 h-4 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-surface-3 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={8} className="stroke-current" strokeWidth={1.5} />
            </span>
          </button>
        );
      })}

      {/* Tab context menu */}
      {contextMenu && contextTab && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-44 py-1 rounded-lg bg-surface-1 border border-default shadow-lg"
          style={{ top: contextMenu.position.y, left: contextMenu.position.x }}
        >
          <ContextMenuItem
            label="Close"
            shortcut="⌘W"
            onClick={() => {
              closeTab(contextMenu.tabId);
              setContextMenu(null);
            }}
          />
          <ContextMenuItem
            label="Close Others"
            onClick={() => {
              closeOtherTabs(contextMenu.tabId);
              setContextMenu(null);
            }}
            disabled={openTabs.length <= 1}
          />
          <ContextMenuItem
            label="Close All"
            onClick={() => {
              closeAllTabs();
              setContextMenu(null);
            }}
          />
          <ContextMenuDivider />
          <ContextMenuItem
            label="Close to the Right"
            onClick={() => {
              closeTabsToRight(contextMenu.tabId);
              setContextMenu(null);
            }}
            disabled={contextTabIdx >= openTabs.length - 1}
          />
          <ContextMenuItem
            label="Close to the Left"
            onClick={() => {
              closeTabsToLeft(contextMenu.tabId);
              setContextMenu(null);
            }}
            disabled={contextTabIdx <= 0}
          />
          <ContextMenuDivider />
          <ContextMenuItem
            label={splitTabId === contextMenu.tabId ? 'Unsplit' : 'Split Right'}
            onClick={() => {
              setSplitTab(splitTabId === contextMenu.tabId ? null : contextMenu.tabId);
              setContextMenu(null);
            }}
          />
          <ContextMenuItem
            label="Copy File Path"
            onClick={() => {
              navigator.clipboard.writeText(contextTab.filePath);
              setContextMenu(null);
            }}
          />
          <ContextMenuItem
            label="Copy File Name"
            onClick={() => {
              navigator.clipboard.writeText(contextTab.fileName);
              setContextMenu(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({
  label,
  shortcut,
  onClick,
  disabled,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-4 ${
        disabled
          ? 'text-muted cursor-default'
          : 'text-secondary hover:text-primary hover:bg-surface-2'
      }`}
    >
      <span>{label}</span>
      {shortcut && <span className="text-muted text-[10px]">{shortcut}</span>}
    </button>
  );
}

function ContextMenuDivider() {
  return <div className="my-1 border-t border-default" />;
}

function SidebarExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-full px-3 flex items-center text-muted hover:text-primary hover:bg-surface-2 transition-colors border-r border-default"
      title="Expand sidebar (⌘B)"
    >
      <PanelLeftOpen size={14} />
    </button>
  );
}
