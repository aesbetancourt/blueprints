import { useState, useEffect, useLayoutEffect, useRef, createContext, useContext } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  MoveUp,
  MoveRight,
  Pencil,
  Trash2,
  EyeOff,
  Check,
} from 'lucide-react';
import { useWorkspaceStore, type FileEntry, type SortMode } from '../store/workspace';
import { useSettingsStore } from '../store/settings';
import { confirm } from './ConfirmDialog';
import { VaultService } from '../services/vault';
import { mapFileEntries } from '../utils/mapFileEntries';
import { IMAGE_INCLUDE_PATTERNS, isImageExtension } from '../utils/imageFiles';
import { useToastStore } from './Toast';
import { ContextMenu } from './CreateFile';

interface MoveState {
  movingPaths: string[];
  isSelectMode: boolean;
  selectedPaths: Set<string>;
  startMove: (paths: string[]) => void;
  cancelMove: () => void;
  executeMove: (targetDir: string) => Promise<void>;
  toggleSelect: (path: string) => void;
  enterSelectMode: () => void;
  exitSelectMode: () => void;
}

const MoveContext = createContext<MoveState>({
  movingPaths: [],
  isSelectMode: false,
  selectedPaths: new Set(),
  startMove: () => {},
  cancelMove: () => {},
  executeMove: async () => {},
  toggleSelect: () => {},
  enterSelectMode: () => {},
  exitSelectMode: () => {},
});

/** Signal context for bulk expand/collapse of all folders */
export interface FolderExpandSignal {
  /** Increments to trigger expand-all */
  expandAll: number;
  /** Increments to trigger collapse-all */
  collapseAll: number;
}

const FolderExpandContext = createContext<FolderExpandSignal>({ expandAll: 0, collapseAll: 0 });

interface FileContextMenuState {
  node: FileEntry;
  position: { x: number; y: number };
}

interface FileContextMenuActions {
  onRename: () => void;
  onDelete: () => void;
  onMove: () => void;
  onOpen?: () => void;
}

export function FileExplorer({
  showArchive,
  showHidden,
  isSelectMode,
  onEnterSelectMode,
  onExitSelectMode,
  folderExpandSignal,
}: {
  showArchive: boolean;
  showHidden: boolean;
  isSelectMode: boolean;
  onEnterSelectMode: () => void;
  onExitSelectMode: () => void;
  folderExpandSignal?: FolderExpandSignal;
}) {
  const { fileTree, vaultPath, sortMode, foldersFirst, recentFiles } = useWorkspaceStore();
  const { setFileTree, updateTabPath, openFile, closeTab } = useWorkspaceStore();
  const { addToast } = useToastStore();
  const [createMenu, setCreateMenu] = useState<{
    dir: string;
    position: { x: number; y: number };
  } | null>(null);
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState | null>(null);
  const [movingPaths, setMovingPaths] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [moveToTarget, setMoveToTarget] = useState<string | null>(null);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  // Callback refs for context menu actions (set by TreeNode that opens the menu)
  const fileMenuActionsRef = useRef<FileContextMenuActions | null>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  const sortedTree = sortTree(fileTree, sortMode, foldersFirst, recentFiles);

  // Settings-based filtering
  const {
    file: fileSettings,
    updateFile,
    tags,
    fileTags,
    assignTag,
    unassignTag,
    addTag,
  } = useSettingsStore();
  const hiddenPaths = fileSettings.hiddenPaths ?? [];
  const includePatterns = fileSettings.includePatterns ?? [
    '*.md',
    '*.excalidraw',
    '*.mermaid',
    '*.typ',
    '*.json',
    '*.yaml',
    '*.yml',
    '*.xml',
    '*.csv',
    ...IMAGE_INCLUDE_PATTERNS,
  ];

  // Filter out _archive folder unless toggled on, and hidden items unless revealed
  // Also apply include patterns (directories always pass if they have visible descendants)
  const filteredTree = sortedTree.filter((node) => {
    if (!showArchive && node.name === '_archive') return false;
    if (!showHidden && hiddenPaths.includes(node.name)) return false;
    if (!node.isDirectory && includePatterns.length > 0) {
      if (!matchesIncludePatterns(node.name, includePatterns)) return false;
    }
    if (node.isDirectory && includePatterns.length > 0) {
      if (!hasVisibleDescendants(node, includePatterns, hiddenPaths, showHidden)) return false;
    }
    return true;
  });

  const handleBackgroundContextMenu = (e: React.MouseEvent, dirPath: string) => {
    e.preventDefault();
    setCreateMenu({ dir: dirPath, position: { x: e.clientX, y: e.clientY } });
  };

  const handleFileContextMenu = (
    e: React.MouseEvent,
    node: FileEntry,
    actions: FileContextMenuActions,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    fileMenuActionsRef.current = actions;
    setFileContextMenu({ node, position: { x: e.clientX, y: e.clientY } });
    setTagMenuOpen(false);
    setNewTagName('');
  };

  const refreshTree = async () => {
    if (!vaultPath) return;
    try {
      const tree = await VaultService.listFiles(vaultPath);
      setFileTree(mapFileEntries(tree));
    } catch (err) {
      addToast(`Failed to refresh: ${err}`, 'error');
    }
  };

  const startMove = (paths: string[]) => {
    setMovingPaths(paths);
    setFileContextMenu(null);
  };

  const cancelMove = () => {
    setMovingPaths([]);
  };

  const executeMove = async (targetDir: string) => {
    if (movingPaths.length === 0) return;

    const errors: string[] = [];
    for (const sourcePath of movingPaths) {
      const fileName = sourcePath.split('/').pop();
      if (!fileName) continue;
      const destPath = `${targetDir}/${fileName}`;

      if (sourcePath === destPath) continue;

      // Don't move a folder into itself
      if (targetDir.startsWith(sourcePath + '/')) {
        errors.push(`Cannot move "${fileName}" into itself`);
        continue;
      }

      try {
        await VaultService.renameFile(sourcePath, destPath);
        updateTabPath(sourcePath, destPath);
      } catch (err) {
        errors.push(`Failed to move "${fileName}": ${err}`);
      }
    }

    if (errors.length > 0) {
      addToast(errors.join('\n'), 'error');
    } else {
      const count = movingPaths.length;
      addToast(`Moved ${count} item${count > 1 ? 's' : ''} successfully`, 'success');
    }

    setMovingPaths([]);
    setSelectedPaths(new Set());
    onExitSelectMode();
    await refreshTree();
  };

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const enterSelectMode = () => {
    onEnterSelectMode();
  };

  const exitSelectMode = () => {
    onExitSelectMode();
    setSelectedPaths(new Set());
  };

  const deleteSelected = async () => {
    if (selectedPaths.size === 0) return;
    const count = selectedPaths.size;
    const confirmed = await confirm({
      title: 'Move to Trash',
      message: `Are you sure you want to move ${count} item${count > 1 ? 's' : ''} to the trash?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    const paths = Array.from(selectedPaths);
    const errors = await VaultService.deleteFiles(paths);

    // Close tabs for successfully deleted files
    const errorPaths = new Set(errors.map((e) => e.split(':')[0]));
    for (const filePath of paths) {
      if (!errorPaths.has(filePath)) {
        closeTab(filePath);
      }
    }

    if (errors.length > 0) {
      addToast(errors.join('\n'), 'error');
    } else {
      addToast(`Deleted ${count} item${count > 1 ? 's' : ''}`, 'success');
    }

    setSelectedPaths(new Set());
    onExitSelectMode();
    await refreshTree();
  };

  // Press Escape to cancel move or exit select mode
  useEffect(() => {
    if (!movingPaths.length && !isSelectMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (movingPaths.length) {
          setMovingPaths([]);
        } else {
          onExitSelectMode();
          setSelectedPaths(new Set());
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [movingPaths, isSelectMode]);

  // Close file context menu on outside click or escape
  useEffect(() => {
    if (!fileContextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFileContextMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [fileContextMenu]);

  // Reposition context menu if it overflows the viewport
  useLayoutEffect(() => {
    if (!fileContextMenu || !fileMenuRef.current) return;
    const el = fileMenuRef.current;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    let top = fileContextMenu.position.y;
    let left = fileContextMenu.position.x;
    if (top + rect.height > viewportH - 8) {
      top = Math.max(8, viewportH - rect.height - 8);
    }
    if (left + rect.width > viewportW - 8) {
      left = Math.max(8, viewportW - rect.width - 8);
    }
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [fileContextMenu, tagMenuOpen]);

  const isInMoveMode = movingPaths.length > 0;

  // Check if the items being moved are all already at root
  const allAtRoot = movingPaths.every((p) => {
    const parts = p.split('/');
    const vaultParts = vaultPath?.split('/') ?? [];
    return parts.length === vaultParts.length + 1;
  });

  if (filteredTree.length === 0) {
    return (
      <div className="px-2 py-8 text-center">
        <p className="text-muted text-xs">No files yet.</p>
        <p className="text-muted text-xs mt-1">Use + to create a document.</p>
      </div>
    );
  }

  return (
    <MoveContext.Provider
      value={{
        movingPaths,
        isSelectMode,
        selectedPaths,
        startMove,
        cancelMove,
        executeMove,
        toggleSelect,
        enterSelectMode,
        exitSelectMode,
      }}
    >
      {/* Select mode toolbar */}
      {isSelectMode && !isInMoveMode && (
        <div className="px-2 py-1.5 mb-1 rounded-md bg-surface-2 border border-border flex items-center justify-between">
          <span className="text-xs text-secondary">{selectedPaths.size} selected</span>
          <div className="flex items-center gap-1">
            {selectedPaths.size > 0 && (
              <>
                <button
                  onClick={() => startMove(Array.from(selectedPaths))}
                  className="text-xs text-accent hover:text-primary px-1.5 py-0.5 rounded hover:bg-surface-3"
                >
                  Move
                </button>
                <button
                  onClick={deleteSelected}
                  className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-950/30"
                >
                  Delete
                </button>
              </>
            )}
            <button
              onClick={exitSelectMode}
              className="text-xs text-muted hover:text-primary px-1.5 py-0.5 rounded hover:bg-surface-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Move mode banner */}
      {isInMoveMode && (
        <div className="px-2 py-1.5 mb-1 rounded-md bg-accent-glow border border-accent flex items-center justify-between">
          <span className="text-xs text-accent truncate">
            Moving {movingPaths.length} item{movingPaths.length > 1 ? 's' : ''}
            {movingPaths.length === 1 && `: ${movingPaths[0].split('/').pop()}`}
          </span>
          <button onClick={cancelMove} className="text-xs text-muted hover:text-primary px-1.5">
            Cancel
          </button>
        </div>
      )}

      {/* Move to root drop target */}
      {isInMoveMode && !allAtRoot && vaultPath && (
        <button
          onClick={() => executeMove(vaultPath)}
          className="w-full px-2 py-1.5 mb-1 rounded-md border border-dashed border-accent text-xs text-accent hover:bg-accent-glow transition-colors flex items-center gap-1.5"
        >
          <MoveUp size={12} />
          Move to root
        </button>
      )}

      <FolderExpandContext.Provider value={folderExpandSignal ?? { expandAll: 0, collapseAll: 0 }}>
        <nav
          className="text-sm select-none"
          onContextMenu={(e) => {
            if (vaultPath) handleBackgroundContextMenu(e, vaultPath);
          }}
        >
          {filteredTree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              onFileContextMenu={handleFileContextMenu}
              showHidden={showHidden}
            />
          ))}
        </nav>
      </FolderExpandContext.Provider>

      {/* Create file context menu (right-click on background) */}
      {createMenu && (
        <ContextMenu
          targetDir={createMenu.dir}
          position={createMenu.position}
          onClose={() => setCreateMenu(null)}
        />
      )}

      {/* File/folder context menu */}
      {fileContextMenu && (
        <div
          ref={fileMenuRef}
          className="fixed z-50 min-w-48 py-1 rounded-lg bg-surface-1 border border-default shadow-lg"
          style={{ top: fileContextMenu.position.y, left: fileContextMenu.position.x }}
        >
          {/* Open (files only) */}
          {!fileContextMenu.node.isDirectory && (
            <FileContextMenuItem
              label="Open"
              onClick={() => {
                openFile(fileContextMenu.node.path);
                setFileContextMenu(null);
              }}
            />
          )}
          {/* New file here (folders only) */}
          {fileContextMenu.node.isDirectory && (
            <FileContextMenuItem
              label="New File Here..."
              onClick={() => {
                setCreateMenu({
                  dir: fileContextMenu.node.path,
                  position: fileContextMenu.position,
                });
                setFileContextMenu(null);
              }}
            />
          )}
          <FileContextMenuDivider />
          <FileContextMenuItem
            label="Rename"
            onClick={() => {
              fileMenuActionsRef.current?.onRename();
              setFileContextMenu(null);
            }}
          />
          <FileContextMenuItem
            label="Move"
            onClick={() => {
              fileMenuActionsRef.current?.onMove();
              setFileContextMenu(null);
            }}
          />
          {!fileContextMenu.node.isDirectory && (
            <>
              <FileContextMenuItem
                label="Move to..."
                onClick={() => {
                  setMoveToTarget(fileContextMenu.node.path);
                  setFileContextMenu(null);
                }}
              />
              <FileContextMenuItem
                label="Move to Archive"
                onClick={async () => {
                  const filePath = fileContextMenu.node.path;
                  const fileName = fileContextMenu.node.name;
                  setFileContextMenu(null);
                  const confirmed = await confirm({
                    title: 'Move to Archive',
                    message: `Move "${fileName}" to the archive folder?`,
                    confirmLabel: 'Archive',
                  });
                  if (!confirmed) return;
                  try {
                    await VaultService.archiveFile(filePath);
                    closeTab(filePath);
                    await refreshTree();
                    addToast('Moved to archive', 'success');
                  } catch (err) {
                    addToast(`Failed to archive: ${err}`, 'error');
                  }
                }}
              />
            </>
          )}
          <FileContextMenuItem
            label={hiddenPaths.includes(fileContextMenu.node.name) ? 'Unhide' : 'Hide'}
            onClick={() => {
              const name = fileContextMenu.node.name;
              if (hiddenPaths.includes(name)) {
                updateFile({ hiddenPaths: hiddenPaths.filter((p) => p !== name) });
              } else {
                updateFile({ hiddenPaths: [...hiddenPaths, name] });
              }
              setFileContextMenu(null);
            }}
          />
          <FileContextMenuDivider />
          {/* Marker submenu */}
          <button
            onClick={() => setTagMenuOpen(!tagMenuOpen)}
            className="w-full px-3 py-1.5 text-left text-xs text-secondary hover:text-primary hover:bg-surface-2 flex items-center justify-between"
          >
            <span>Markers</span>
            <ChevronDown
              size={8}
              className={`transition-transform ${tagMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {tagMenuOpen && (
            <div className="px-2 py-1 border-t border-b border-default bg-surface-0">
              {(tags ?? []).map((tag) => {
                const isAssigned = ((fileTags ?? {})[fileContextMenu.node.path] ?? []).includes(
                  tag.id,
                );
                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      if (isAssigned) {
                        unassignTag(fileContextMenu.node.path, tag.id);
                      } else {
                        assignTag(fileContextMenu.node.path, tag.id);
                      }
                    }}
                    className="w-full px-2 py-1 text-left text-xs flex items-center gap-2 rounded hover:bg-surface-2"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className={isAssigned ? 'text-primary font-medium' : 'text-secondary'}>
                      {tag.label}
                    </span>
                    {isAssigned && <Check size={10} className="ml-auto text-accent" />}
                  </button>
                );
              })}
              {/* Create custom marker */}
              <div className="mt-1 pt-1 border-t border-default">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTagName.trim()) {
                        const id = newTagName.trim().toLowerCase().replace(/\s+/g, '-');
                        const colors = [
                          '#3b82f6',
                          '#10b981',
                          '#f59e0b',
                          '#ef4444',
                          '#8b5cf6',
                          '#ec4899',
                          '#06b6d4',
                        ];
                        const color = colors[Math.floor(Math.random() * colors.length)];
                        addTag({ id, label: newTagName.trim(), color });
                        assignTag(fileContextMenu.node.path, id);
                        setNewTagName('');
                      }
                    }}
                    placeholder="New marker..."
                    className="flex-1 min-w-0 bg-surface-1 border border-default rounded px-1.5 py-0.5 text-xs text-primary outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => {
                      if (!newTagName.trim()) return;
                      const id = newTagName.trim().toLowerCase().replace(/\s+/g, '-');
                      const colors = [
                        '#3b82f6',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444',
                        '#8b5cf6',
                        '#ec4899',
                        '#06b6d4',
                      ];
                      const color = colors[Math.floor(Math.random() * colors.length)];
                      addTag({ id, label: newTagName.trim(), color });
                      assignTag(fileContextMenu.node.path, id);
                      setNewTagName('');
                    }}
                    className="px-1.5 py-0.5 text-xs text-accent hover:text-primary rounded hover:bg-surface-2"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}
          <FileContextMenuItem
            label="Delete"
            danger
            onClick={() => {
              fileMenuActionsRef.current?.onDelete();
              setFileContextMenu(null);
            }}
          />
          <FileContextMenuDivider />
          <FileContextMenuItem
            label="Copy Path"
            onClick={() => {
              navigator.clipboard.writeText(fileContextMenu.node.path);
              addToast('Path copied', 'success');
              setFileContextMenu(null);
            }}
          />
          <FileContextMenuItem
            label="Copy Name"
            onClick={() => {
              navigator.clipboard.writeText(fileContextMenu.node.name);
              addToast('Name copied', 'success');
              setFileContextMenu(null);
            }}
          />
          {!fileContextMenu.node.isDirectory && (
            <>
              <FileContextMenuDivider />
              <FileContextMenuItem
                label="Open in Split"
                onClick={() => {
                  const { setSplitTab } = useWorkspaceStore.getState();
                  openFile(fileContextMenu.node.path);
                  setSplitTab(fileContextMenu.node.path);
                  setFileContextMenu(null);
                }}
              />
              <FileContextMenuItem
                label={
                  useWorkspaceStore.getState().pinnedFiles.includes(fileContextMenu.node.path)
                    ? 'Unpin'
                    : 'Pin to Favorites'
                }
                onClick={() => {
                  useWorkspaceStore.getState().togglePin(fileContextMenu.node.path);
                  setFileContextMenu(null);
                }}
              />
            </>
          )}
        </div>
      )}

      {/* Move to... modal */}
      {moveToTarget && (
        <MoveToModal
          filePath={moveToTarget}
          onClose={() => setMoveToTarget(null)}
          onMoved={async () => {
            setMoveToTarget(null);
            await refreshTree();
          }}
        />
      )}
    </MoveContext.Provider>
  );
}

/** Convert a glob pattern like "*.md" to a regex test */
function matchesIncludePatterns(fileName: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Convert simple glob to regex: * -> .*, ? -> ., rest escaped
    const regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`, 'i').test(fileName);
  });
}

/** Returns true if a directory has at least one visible descendant (matching file or nested dir with matches) */
function hasVisibleDescendants(
  node: FileEntry,
  patterns: string[],
  hiddenPaths: string[],
  showHidden: boolean,
): boolean {
  if (!node.children || node.children.length === 0) return true;
  return node.children.some((child) => {
    if (!showHidden && hiddenPaths.includes(child.name)) return false;
    if (child.isDirectory) return hasVisibleDescendants(child, patterns, hiddenPaths, showHidden);
    if (patterns.length > 0) return matchesIncludePatterns(child.name, patterns);
    return true;
  });
}

function sortTree(
  entries: FileEntry[],
  mode: SortMode,
  foldersFirst: boolean,
  recentFiles?: string[],
): FileEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // Directories grouping
    if (foldersFirst) {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
    }

    switch (mode) {
      case 'type': {
        const extA = a.name.split('.').pop() ?? '';
        const extB = b.name.split('.').pop() ?? '';
        if (extA !== extB) return extA.localeCompare(extB);
        return a.name.localeCompare(b.name);
      }
      case 'date':
        return b.name.localeCompare(a.name);
      case 'recent': {
        if (!recentFiles) return a.name.localeCompare(b.name);
        const idxA = recentFiles.indexOf(a.path);
        const idxB = recentFiles.indexOf(b.path);
        // Files not in recent list go to the end, sorted by name
        if (idxA === -1 && idxB === -1) return a.name.localeCompare(b.name);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB; // lower index = more recent
      }
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });

  return sorted.map((entry) => {
    if (entry.isDirectory && entry.children) {
      return { ...entry, children: sortTree(entry.children, mode, foldersFirst, recentFiles) };
    }
    return entry;
  });
}

function TreeNode({
  node,
  depth,
  onFileContextMenu,
  showHidden,
}: {
  node: FileEntry;
  depth: number;
  onFileContextMenu: (
    e: React.MouseEvent,
    node: FileEntry,
    actions: FileContextMenuActions,
  ) => void;
  showHidden: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const renameRef = useRef<HTMLInputElement>(null);
  const { openFile, activeTabId, vaultPath, setFileTree, closeTab } = useWorkspaceStore();
  const { addToast } = useToastStore();
  const { movingPaths, isSelectMode, selectedPaths, startMove, executeMove, toggleSelect } =
    useContext(MoveContext);
  const folderSignal = useContext(FolderExpandContext);
  const { file: fileSettings, tags, fileTags } = useSettingsStore();
  const isHidden = (fileSettings.hiddenPaths ?? []).includes(node.name);
  const nodeTagIds = (fileTags ?? {})[node.path] ?? [];
  const nodeTags = (tags ?? []).filter((t) => nodeTagIds.includes(t.id));
  const paddingLeft = `${depth * 12 + 8}px`;

  const isInMoveMode = movingPaths.length > 0;
  const isBeingMoved = movingPaths.includes(node.path);
  const isSelected = selectedPaths.has(node.path);

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  // React to bulk expand/collapse signals (only for directories, skip initial mount)
  const mountedExpandRef = useRef(folderSignal.expandAll);
  const mountedCollapseRef = useRef(folderSignal.collapseAll);

  useEffect(() => {
    if (folderSignal.expandAll !== mountedExpandRef.current && node.isDirectory) {
      setExpanded(true);
    }
    mountedExpandRef.current = folderSignal.expandAll;
  }, [folderSignal.expandAll, node.isDirectory]);

  useEffect(() => {
    if (folderSignal.collapseAll !== mountedCollapseRef.current && node.isDirectory) {
      setExpanded(false);
    }
    mountedCollapseRef.current = folderSignal.collapseAll;
  }, [folderSignal.collapseAll, node.isDirectory]);

  const refreshTree = async () => {
    if (!vaultPath) return;
    try {
      const tree = await VaultService.listFiles(vaultPath);
      setFileTree(mapFileEntries(tree));
    } catch (err) {
      addToast(`Failed to refresh: ${err}`, 'error');
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Move to Trash',
      message: `Are you sure you want to move "${node.name}" to the trash?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await VaultService.deleteFile(node.path);
      closeTab(node.path);
      await refreshTree();
    } catch (err) {
      addToast(`Failed to delete: ${err}`, 'error');
    }
  };

  const handleRenameSubmit = async () => {
    setRenaming(false);
    if (!renameValue.trim() || renameValue === node.name) return;
    const parentDir = node.path.substring(0, node.path.lastIndexOf('/'));
    const newPath = `${parentDir}/${renameValue}`;
    try {
      await VaultService.renameFile(node.path, newPath);
      await refreshTree();
    } catch (err) {
      addToast(`Failed to rename: ${err}`, 'error');
    }
  };

  const contextMenuActions: FileContextMenuActions = {
    onRename: () => {
      setRenameValue(node.name);
      setRenaming(true);
    },
    onDelete: handleDelete,
    onMove: () => startMove([node.path]),
    onOpen: node.isDirectory ? undefined : () => openFile(node.path),
  };

  if (node.isDirectory) {
    const isMoveTarget = isInMoveMode && !isBeingMoved;

    return (
      <div>
        <div
          className={`group w-full flex items-center rounded-md text-secondary ${isMoveTarget ? 'hover:bg-accent-glow hover:border-accent border border-transparent cursor-pointer' : 'hover:bg-surface-2'} ${isBeingMoved ? 'opacity-50' : ''}`}
          onContextMenu={(e) => onFileContextMenu(e, node, contextMenuActions)}
          onClick={(e) => {
            if (isInMoveMode && isMoveTarget) {
              e.stopPropagation();
              executeMove(node.path);
            }
          }}
        >
          {/* Checkbox in select mode */}
          {isSelectMode && !isInMoveMode && (
            <label
              className="flex items-center pl-1 cursor-pointer"
              style={{ paddingLeft: depth === 0 ? '4px' : undefined }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(node.path)}
                className="w-3 h-3 rounded border-border accent-accent cursor-pointer"
              />
            </label>
          )}
          <button
            onClick={(e) => {
              if (isInMoveMode) return;
              if (isSelectMode) {
                toggleSelect(node.path);
                return;
              }
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex-1 text-left px-2 py-1 flex items-center gap-1.5"
            style={{ paddingLeft: isSelectMode ? '4px' : paddingLeft }}
          >
            <ChevronRight
              size={10}
              className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
            />
            <Folder size={13} fill="var(--color-text-muted)" className="shrink-0" />
            {renaming ? (
              <input
                ref={renameRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') setRenaming(false);
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 bg-surface-0 border border-accent rounded px-1 py-0.5 text-xs text-primary outline-none"
              />
            ) : (
              <span className={`text-xs truncate ${isHidden ? 'opacity-40 italic' : ''}`}>
                {node.name}
              </span>
            )}
            {isHidden && <EyeOff size={10} className="shrink-0 text-muted opacity-60 ml-1" />}
            {nodeTags.length > 0 && (
              <span className="flex items-center gap-0.5 ml-1 shrink-0">
                {nodeTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="px-1 py-0 rounded text-[9px] font-medium leading-tight"
                    style={{ backgroundColor: tag.color + '22', color: tag.color }}
                  >
                    {tag.label}
                  </span>
                ))}
              </span>
            )}
            {isMoveTarget && <span className="text-xs text-accent ml-auto">Drop here</span>}
          </button>
          {!renaming && !isInMoveMode && !isSelectMode && (
            <div className="hidden group-hover:flex items-center gap-0.5 pr-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameValue(node.name);
                  setRenaming(true);
                }}
                className="p-0.5 rounded hover:bg-surface-3 text-muted hover:text-primary"
                title="Rename"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={handleDelete}
                className="p-0.5 rounded hover:bg-surface-3 text-muted hover:text-danger"
                title="Delete"
              >
                <Trash2 size={11} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startMove([node.path]);
                }}
                className="p-0.5 rounded hover:bg-surface-3 text-muted hover:text-accent"
                title="Move"
              >
                <MoveRight size={11} />
              </button>
            </div>
          )}
        </div>
        {expanded &&
          node.children
            ?.filter((child) => {
              if (!showHidden && (fileSettings.hiddenPaths ?? []).includes(child.name))
                return false;
              const patterns = fileSettings.includePatterns ?? [];
              if (!child.isDirectory && patterns.length > 0) {
                if (!matchesIncludePatterns(child.name, patterns)) return false;
              }
              if (child.isDirectory && patterns.length > 0) {
                if (
                  !hasVisibleDescendants(
                    child,
                    patterns,
                    fileSettings.hiddenPaths ?? [],
                    showHidden,
                  )
                )
                  return false;
              }
              return true;
            })
            .map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileContextMenu={onFileContextMenu}
                showHidden={showHidden}
              />
            ))}
      </div>
    );
  }

  const isActive = activeTabId === node.path;
  const ext = node.name.split('.').pop();

  return (
    <div
      className={`group flex items-center rounded-md ${isBeingMoved ? 'opacity-50' : ''} ${isActive ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
      onContextMenu={(e) => onFileContextMenu(e, node, contextMenuActions)}
    >
      {/* Checkbox in select mode */}
      {isSelectMode && !isInMoveMode && (
        <label
          className="flex items-center pl-1 cursor-pointer"
          style={{ paddingLeft: depth === 0 ? '4px' : undefined }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(node.path)}
            className="w-3 h-3 rounded border-border accent-accent cursor-pointer"
          />
        </label>
      )}
      {renaming ? (
        <input
          ref={renameRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit();
            if (e.key === 'Escape') setRenaming(false);
          }}
          className="flex-1 bg-surface-0 border border-accent rounded px-1 py-0.5 text-xs text-primary outline-none mx-1"
          style={{ marginLeft: paddingLeft }}
        />
      ) : (
        <>
          <button
            onClick={() => {
              if (isInMoveMode) return;
              if (isSelectMode) {
                toggleSelect(node.path);
                return;
              }
              openFile(node.path);
            }}
            className={`flex-1 text-left px-2 py-1 flex items-center gap-2 min-w-0 ${isActive ? 'text-primary' : 'text-secondary'}`}
            style={{ paddingLeft: isSelectMode ? '4px' : paddingLeft }}
          >
            <FileIcon ext={ext} />
            <span className={`truncate text-xs ${isHidden ? 'opacity-40 italic' : ''}`}>
              {node.name}
            </span>
            {isHidden && <EyeOff size={10} className="shrink-0 text-muted opacity-60" />}
            {nodeTags.length > 0 && (
              <span className="flex items-center gap-0.5 ml-auto shrink-0">
                {nodeTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="px-1 py-0 rounded text-[9px] font-medium leading-tight"
                    style={{ backgroundColor: tag.color + '22', color: tag.color }}
                  >
                    {tag.label}
                  </span>
                ))}
              </span>
            )}
          </button>
          {!isInMoveMode && !isSelectMode && (
            <div className="hidden group-hover:flex items-center gap-0.5 pr-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameValue(node.name);
                  setRenaming(true);
                }}
                className="p-0.5 rounded hover:bg-surface-3 text-muted hover:text-primary"
                title="Rename"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={handleDelete}
                className="p-0.5 rounded hover:bg-surface-3 text-muted hover:text-danger"
                title="Delete"
              >
                <Trash2 size={11} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startMove([node.path]);
                }}
                className="p-0.5 rounded hover:bg-surface-3 text-muted hover:text-accent"
                title="Move"
              >
                <MoveRight size={11} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FileContextMenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-1.5 text-left text-xs ${
        danger
          ? 'text-danger hover:bg-danger/10'
          : 'text-secondary hover:text-primary hover:bg-surface-2'
      }`}
    >
      {label}
    </button>
  );
}

function FileContextMenuDivider() {
  return <div className="my-1 border-t border-default" />;
}

export function MoveToModal({
  filePath,
  onClose,
  onMoved,
}: {
  filePath: string;
  onClose: () => void;
  onMoved: () => void;
}) {
  const { vaultPath, fileTree, updateTabPath } = useWorkspaceStore();
  const { addToast } = useToastStore();
  const { quickNote } = useSettingsStore();
  const [customFolder, setCustomFolder] = useState('');

  // Preset folders: inbox from settings + archive
  const presets = [
    { label: 'Inbox', folder: quickNote.folder || 'inbox' },
    { label: 'Archive', folder: '_archive' },
  ];

  // Collect existing top-level directories
  const existingDirs = fileTree
    .filter((f) => f.isDirectory)
    .map((f) => f.name)
    .filter((name) => !presets.some((p) => p.folder === name) && !name.startsWith('.'));

  const handleMove = async (folder: string) => {
    if (!vaultPath) return;
    const destFolder = `${vaultPath}/${folder}`;
    try {
      const newPath = await VaultService.moveFile(filePath, destFolder);
      updateTabPath(filePath, newPath);
      addToast(`Moved to ${folder}/`, 'success');
      onMoved();
    } catch (err) {
      addToast(`Failed to move: ${err}`, 'error');
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const fileName = filePath.split('/').pop() ?? '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-80 bg-surface-1 border border-default rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-default">
          <h3 className="text-xs font-medium text-primary">Move &quot;{fileName}&quot; to...</h3>
        </div>
        <div className="p-2 max-h-64 overflow-y-auto space-y-0.5">
          {presets.map((p) => (
            <button
              key={p.folder}
              onClick={() => handleMove(p.folder)}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-secondary hover:text-primary hover:bg-surface-2 flex items-center gap-2 transition-colors"
            >
              <FolderSmallIcon />
              <span className="font-medium">{p.label}</span>
              <span className="text-muted ml-auto">/{p.folder}</span>
            </button>
          ))}
          {existingDirs.length > 0 && (
            <>
              <div className="my-1.5 border-t border-default" />
              {existingDirs.map((dir) => (
                <button
                  key={dir}
                  onClick={() => handleMove(dir)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-secondary hover:text-primary hover:bg-surface-2 flex items-center gap-2 transition-colors"
                >
                  <FolderSmallIcon />
                  <span>{dir}</span>
                </button>
              ))}
            </>
          )}
          <div className="my-1.5 border-t border-default" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customFolder.trim()) handleMove(customFolder.trim());
            }}
            className="flex items-center gap-2 px-2 py-1"
          >
            <input
              type="text"
              value={customFolder}
              onChange={(e) => setCustomFolder(e.target.value)}
              placeholder="Custom folder..."
              className="flex-1 bg-surface-2 border border-default rounded-md px-2 py-1.5 text-xs text-primary outline-none focus:border-accent placeholder-muted"
              autoFocus
            />
            <button
              type="submit"
              disabled={!customFolder.trim()}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-accent text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Move
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function FolderSmallIcon() {
  return <Folder size={12} fill="var(--color-text-muted)" className="shrink-0" />;
}

function FileIcon({ ext }: { ext: string | undefined }) {
  if (isImageExtension(ext)) {
    return (
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#38bdf8' }} />
    );
  }
  switch (ext) {
    case 'md':
      return (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: 'var(--color-accent)' }}
        />
      );
    case 'excalidraw':
      return (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: 'var(--color-warning)' }}
        />
      );
    case 'mermaid':
      return (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: 'var(--color-success)' }}
        />
      );
    case 'typ':
      return (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#22d3ee' }} />
      );
    case 'json':
      return (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#a78bfa' }} />
      );
    case 'yaml':
      return (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#f472b6' }} />
      );
    case 'xml':
      return (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#fb923c' }} />
      );
    case 'csv':
      return (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#34d399' }} />
      );
    default:
      return (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: 'var(--color-text-muted)' }}
        />
      );
  }
}
