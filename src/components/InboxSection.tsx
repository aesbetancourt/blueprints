import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, Inbox } from 'lucide-react';
import { useWorkspaceStore } from '../store/workspace';
import { useSettingsStore } from '../store/settings';
import { VaultService } from '../services/vault';
import { useToastStore } from './Toast';
import { MoveToModal } from './FileExplorer';

export function InboxSection() {
  const [expanded, setExpanded] = useState(true);
  const [inboxFiles, setInboxFiles] = useState<{ name: string; path: string }[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    path: string;
    position: { x: number; y: number };
  } | null>(null);
  const [moveToTarget, setMoveToTarget] = useState<string | null>(null);
  const { vaultPath, openFile, fileTree, closeTab } = useWorkspaceStore();
  const { quickNote } = useSettingsStore();
  const { addToast } = useToastStore();
  const menuRef = useRef<HTMLDivElement>(null);

  const inboxFolder = quickNote.folder || 'inbox';

  const loadInbox = useCallback(async () => {
    if (!vaultPath) return;
    const inboxPath = `${vaultPath}/${inboxFolder}`;
    try {
      const entries = await VaultService.listFiles(inboxPath);
      const files = entries
        .filter((e) => !e.is_directory && !e.name.startsWith('.'))
        .map((e) => ({ name: e.name, path: e.path }))
        .sort((a, b) => b.name.localeCompare(a.name)); // newest first (timestamp names)
      setInboxFiles(files);
    } catch {
      // Inbox folder doesn't exist yet
      setInboxFiles([]);
    }
  }, [vaultPath, inboxFolder]);

  // Reload when fileTree changes (file created/moved/deleted)
  useEffect(() => {
    loadInbox();
  }, [loadInbox, fileTree]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, filePath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ path: filePath, position: { x: e.clientX, y: e.clientY } });
  };

  const handleArchive = async (filePath: string) => {
    setContextMenu(null);
    try {
      await VaultService.archiveFile(filePath);
      closeTab(filePath);
      addToast('Moved to archive', 'success');
    } catch (err) {
      addToast(`Failed to archive: ${err}`, 'error');
    }
  };

  if (inboxFiles.length === 0) return null;

  return (
    <div className="border-t border-default">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 group"
      >
        <div className="flex items-center gap-2 text-xs font-medium text-muted uppercase tracking-wider group-hover:text-secondary transition-colors">
          <ChevronRight
            size={10}
            className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          />
          Inbox
        </div>
        <span className="px-1.5 py-0.5 rounded-full bg-accent text-white text-xs font-medium min-w-[20px] text-center">
          {inboxFiles.length}
        </span>
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-0.5">
          {inboxFiles.map((file) => (
            <button
              key={file.path}
              onClick={() => openFile(file.path)}
              onContextMenu={(e) => handleContextMenu(e, file.path)}
              className="w-full text-left px-2 py-1.5 rounded-md text-xs text-secondary hover:bg-surface-2 hover:text-primary truncate flex items-center gap-2 transition-colors"
            >
              <InboxFileIcon />
              <span className="truncate">{file.name}</span>
            </button>
          ))}
          <p className="px-2 pt-1 text-xs text-muted">Right-click to triage</p>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-44 py-1 rounded-lg bg-surface-1 border border-default shadow-lg"
          style={{ top: contextMenu.position.y, left: contextMenu.position.x }}
        >
          <button
            onClick={() => {
              openFile(contextMenu.path);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-xs text-secondary hover:text-primary hover:bg-surface-2"
          >
            Open
          </button>
          <div className="my-1 border-t border-default" />
          <button
            onClick={() => {
              setMoveToTarget(contextMenu.path);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-xs text-secondary hover:text-primary hover:bg-surface-2"
          >
            Move to...
          </button>
          <button
            onClick={() => handleArchive(contextMenu.path)}
            className="w-full px-3 py-1.5 text-left text-xs text-secondary hover:text-primary hover:bg-surface-2"
          >
            Move to Archive
          </button>
          <div className="my-1 border-t border-default" />
          <button
            onClick={async () => {
              setContextMenu(null);
              try {
                await VaultService.deleteFile(contextMenu.path);
                closeTab(contextMenu.path);
                addToast('Deleted', 'success');
              } catch (err) {
                addToast(`Failed to delete: ${err}`, 'error');
              }
            }}
            className="w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-danger/10"
          >
            Delete
          </button>
        </div>
      )}

      {/* Move to modal */}
      {moveToTarget && (
        <MoveToModal
          filePath={moveToTarget}
          onClose={() => setMoveToTarget(null)}
          onMoved={() => setMoveToTarget(null)}
        />
      )}
    </div>
  );
}

function InboxFileIcon() {
  return <Inbox size={10} className="text-muted shrink-0" />;
}
