import { create } from 'zustand';
import { createTauriStore } from '@tauri-store/zustand';
import { VaultService } from '../services/vault';

export type FileType = 'md' | 'excalidraw' | 'mermaid' | 'json' | 'yaml' | 'xml' | 'csv';

export interface TabGroup {
  id: string;
  name: string;
  order: number;
  collapsed: boolean;
}

export interface Tab {
  id: string;
  filePath: string;
  fileName: string;
  fileType: FileType;
  isDirty: boolean;
  groupId?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

export type SortMode = 'name' | 'type' | 'date' | 'recent';

export interface SortConfig {
  mode: SortMode;
  foldersFirst: boolean;
}

export interface RecentVault {
  path: string;
  name: string;
  lastOpened: number;
}

export interface DocumentStats {
  chars: number;
  words: number;
  tokens: number;
}

interface WorkspaceState {
  vaultPath: string | null;
  vaultReady: boolean;
  fileTree: FileEntry[];
  openTabs: Tab[];
  activeTabId: string | null;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  recentFiles: string[];
  recentVaults: RecentVault[];
  splitTabId: string | null;
  sortMode: SortMode;
  foldersFirst: boolean;
  documentStats: DocumentStats | null;
  pinnedFiles: string[];
  tabGroups: TabGroup[];

  setVault: (path: string) => void;
  setVaultReady: (ready: boolean) => void;
  closeVault: () => void;
  setFileTree: (tree: FileEntry[]) => void;
  setDocumentStats: (stats: DocumentStats | null) => void;
  openFile: (path: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  markDirty: (id: string, dirty: boolean) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  nextTab: () => void;
  prevTab: () => void;
  setSplitTab: (id: string | null) => void;
  setSortMode: (mode: SortMode) => void;
  setFoldersFirst: (value: boolean) => void;
  updateTabPath: (oldPath: string, newPath: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  closeTabsToLeft: (id: string) => void;
  togglePin: (path: string) => void;
  moveTabToNewGroup: (tabId: string) => void;
  moveTabToGroup: (tabId: string, groupId: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  removeTabFromGroup: (tabId: string) => void;
  toggleGroupCollapsed: (groupId: string) => void;
}

function getFileType(path: string): FileType {
  if (path.endsWith('.excalidraw')) return 'excalidraw';
  if (path.endsWith('.mermaid')) return 'mermaid';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
  if (path.endsWith('.xml')) return 'xml';
  if (path.endsWith('.csv')) return 'csv';
  return 'md';
}

function getFileName(path: string): string {
  return path.split('/').pop() ?? path;
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  vaultPath: null,
  vaultReady: false,
  fileTree: [],
  openTabs: [],
  activeTabId: null,
  sidebarWidth: 240,
  sidebarCollapsed: false,
  recentFiles: [],
  recentVaults: [],
  splitTabId: null,
  sortMode: 'name' as SortMode,
  foldersFirst: true,
  documentStats: null,
  pinnedFiles: [],
  tabGroups: [],

  setVault: (path) => {
    const name = path.split('/').pop() ?? path;
    const { recentVaults } = get();
    const updated = [
      { path, name, lastOpened: Date.now() },
      ...recentVaults.filter((v) => v.path !== path),
    ].slice(0, 10);
    set({ vaultPath: path, recentVaults: updated });
  },

  setVaultReady: (ready) => set({ vaultReady: ready }),

  closeVault: () =>
    set({
      vaultPath: null,
      vaultReady: false,
      fileTree: [],
      openTabs: [],
      activeTabId: null,
      splitTabId: null,
      recentFiles: [],
    }),

  setFileTree: (tree) => set({ fileTree: tree }),

  setDocumentStats: (stats) => set({ documentStats: stats }),

  openFile: (path) => {
    const { openTabs, recentFiles } = get();
    const existing = openTabs.find((t) => t.filePath === path);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    const tab: Tab = {
      id: path,
      filePath: path,
      fileName: getFileName(path),
      fileType: getFileType(path),
      isDirty: false,
    };
    const updatedRecent = [path, ...recentFiles.filter((r) => r !== path)].slice(0, 20);
    set({ openTabs: [...openTabs, tab], activeTabId: tab.id, recentFiles: updatedRecent });
    // Pre-fetch file content into cache so EditorPane renders instantly
    VaultService.readFile(path).catch(() => {});
  },

  closeTab: (id) => {
    const { openTabs, activeTabId, splitTabId, tabGroups } = get();
    const closedTab = openTabs.find((t) => t.id === id);
    const idx = openTabs.findIndex((t) => t.id === id);
    const next = openTabs.filter((t) => t.id !== id);
    let newActive = activeTabId;
    if (activeTabId === id) {
      const prev = next[Math.min(idx, next.length - 1)];
      newActive = prev?.id ?? null;
    }
    const newSplit = splitTabId === id ? null : splitTabId;
    // Auto-delete empty groups
    let newGroups = tabGroups;
    if (closedTab?.groupId) {
      const groupStillHasTabs = next.some((t) => t.groupId === closedTab.groupId);
      if (!groupStillHasTabs) {
        newGroups = tabGroups.filter((g) => g.id !== closedTab.groupId);
      }
    }
    set({ openTabs: next, activeTabId: newActive, splitTabId: newSplit, tabGroups: newGroups });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  markDirty: (id, dirty) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) => (t.id === id ? { ...t, isDirty: dirty } : t)),
    })),

  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  nextTab: () => {
    const { openTabs, activeTabId } = get();
    if (openTabs.length <= 1) return;
    const idx = openTabs.findIndex((t) => t.id === activeTabId);
    const next = openTabs[(idx + 1) % openTabs.length];
    set({ activeTabId: next.id });
  },

  prevTab: () => {
    const { openTabs, activeTabId } = get();
    if (openTabs.length <= 1) return;
    const idx = openTabs.findIndex((t) => t.id === activeTabId);
    const prev = openTabs[(idx - 1 + openTabs.length) % openTabs.length];
    set({ activeTabId: prev.id });
  },

  setSplitTab: (id) => set({ splitTabId: id }),

  setSortMode: (mode) => set({ sortMode: mode }),
  setFoldersFirst: (value) => set({ foldersFirst: value }),

  updateTabPath: (oldPath, newPath) =>
    set((s) => {
      const newFileName = getFileName(newPath);
      const newFileType = getFileType(newPath);
      const openTabs = s.openTabs.map((t) => {
        // Exact match (file was moved)
        if (t.filePath === oldPath) {
          return {
            ...t,
            id: newPath,
            filePath: newPath,
            fileName: newFileName,
            fileType: newFileType,
          };
        }
        // Child of a moved directory
        if (t.filePath.startsWith(oldPath + '/')) {
          const updatedPath = newPath + t.filePath.slice(oldPath.length);
          return {
            ...t,
            id: updatedPath,
            filePath: updatedPath,
            fileName: getFileName(updatedPath),
            fileType: getFileType(updatedPath),
          };
        }
        return t;
      });
      const activeTabId =
        s.activeTabId === oldPath
          ? newPath
          : s.activeTabId?.startsWith(oldPath + '/')
            ? newPath + s.activeTabId.slice(oldPath.length)
            : s.activeTabId;
      const splitTabId =
        s.splitTabId === oldPath
          ? newPath
          : s.splitTabId?.startsWith(oldPath + '/')
            ? newPath + s.splitTabId.slice(oldPath.length)
            : s.splitTabId;
      return { openTabs, activeTabId, splitTabId };
    }),

  closeAllTabs: () => set({ openTabs: [], activeTabId: null, splitTabId: null }),

  closeOtherTabs: (id) =>
    set((s) => {
      const kept = s.openTabs.filter((t) => t.id === id);
      return { openTabs: kept, activeTabId: id, splitTabId: null };
    }),

  closeTabsToRight: (id) =>
    set((s) => {
      const idx = s.openTabs.findIndex((t) => t.id === id);
      const kept = s.openTabs.slice(0, idx + 1);
      const newActive = kept.find((t) => t.id === s.activeTabId) ? s.activeTabId : id;
      const newSplit = kept.find((t) => t.id === s.splitTabId) ? s.splitTabId : null;
      return { openTabs: kept, activeTabId: newActive, splitTabId: newSplit };
    }),

  closeTabsToLeft: (id) =>
    set((s) => {
      const idx = s.openTabs.findIndex((t) => t.id === id);
      const kept = s.openTabs.slice(idx);
      const newActive = kept.find((t) => t.id === s.activeTabId) ? s.activeTabId : id;
      const newSplit = kept.find((t) => t.id === s.splitTabId) ? s.splitTabId : null;
      return { openTabs: kept, activeTabId: newActive, splitTabId: newSplit };
    }),

  togglePin: (path) =>
    set((s) => {
      const pinned = s.pinnedFiles.includes(path)
        ? s.pinnedFiles.filter((p) => p !== path)
        : [...s.pinnedFiles, path];
      return { pinnedFiles: pinned };
    }),

  moveTabToNewGroup: (tabId) =>
    set((s) => {
      const nextOrder =
        s.tabGroups.length > 0 ? Math.max(...s.tabGroups.map((g) => g.order)) + 1 : 1;
      const groupId = `group-${Date.now()}`;
      const newGroup: TabGroup = {
        id: groupId,
        name: `Group ${nextOrder}`,
        order: nextOrder,
        collapsed: false,
      };
      const openTabs = s.openTabs.map((t) => (t.id === tabId ? { ...t, groupId } : t));
      return { tabGroups: [...s.tabGroups, newGroup], openTabs };
    }),

  moveTabToGroup: (tabId, groupId) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) => (t.id === tabId ? { ...t, groupId } : t)),
    })),

  renameGroup: (groupId, name) =>
    set((s) => ({
      tabGroups: s.tabGroups.map((g) => (g.id === groupId ? { ...g, name } : g)),
    })),

  deleteGroup: (groupId) =>
    set((s) => ({
      tabGroups: s.tabGroups.filter((g) => g.id !== groupId),
      openTabs: s.openTabs.map((t) => (t.groupId === groupId ? { ...t, groupId: undefined } : t)),
    })),

  removeTabFromGroup: (tabId) =>
    set((s) => {
      const tab = s.openTabs.find((t) => t.id === tabId);
      if (!tab?.groupId) return {};
      const groupId = tab.groupId;
      const openTabs = s.openTabs.map((t) => (t.id === tabId ? { ...t, groupId: undefined } : t));
      // If the group is now empty, auto-delete it
      const groupStillHasTabs = openTabs.some((t) => t.groupId === groupId);
      const tabGroups = groupStillHasTabs
        ? s.tabGroups
        : s.tabGroups.filter((g) => g.id !== groupId);
      return { openTabs, tabGroups };
    }),

  toggleGroupCollapsed: (groupId) =>
    set((s) => ({
      tabGroups: s.tabGroups.map((g) => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g)),
    })),
}));

// Tauri Store handler — persists state to disk
// Excludes transient keys (fileTree, documentStats, vaultReady) from persistence
// On hydration from disk: re-derives fileType, resets isDirty
export const workspaceStoreHandler = createTauriStore(
  'workspace',
  useWorkspaceStore as unknown as import('zustand').StoreApi<Record<string, unknown>>,
  {
    autoStart: false,
    saveOnChange: true,
    saveStrategy: 'debounce',
    saveInterval: 1000,
    filterKeys: [
      'vaultPath',
      'openTabs',
      'activeTabId',
      'sidebarWidth',
      'sidebarCollapsed',
      'recentFiles',
      'recentVaults',
      'splitTabId',
      'sortMode',
      'foldersFirst',
      'pinnedFiles',
      'tabGroups',
    ],
    filterKeysStrategy: 'pick',
    hooks: {
      beforeFrontendSync: (state) => {
        // Re-derive fileType from filePath for new format support
        if (state.openTabs) {
          state.openTabs = (state.openTabs as Tab[]).map((t) => ({
            ...t,
            isDirty: false,
            fileType: getFileType(t.filePath),
          }));
        }
        // Hydration safety
        if (!state.tabGroups) state.tabGroups = [];
        return state;
      },
      error: (err) => {
        console.error('[workspace store]', err);
      },
    },
  },
);
