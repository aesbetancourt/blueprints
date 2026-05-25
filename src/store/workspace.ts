import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VaultService } from '../services/vault';

export type FileType = 'md' | 'excalidraw' | 'mermaid' | 'json';

export interface Tab {
  id: string;
  filePath: string;
  fileName: string;
  fileType: FileType;
  isDirty: boolean;
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

  setVault: (path: string) => void;
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
}

function getFileType(path: string): FileType {
  if (path.endsWith('.excalidraw')) return 'excalidraw';
  if (path.endsWith('.mermaid')) return 'mermaid';
  if (path.endsWith('.json')) return 'json';
  return 'md';
}

function getFileName(path: string): string {
  return path.split('/').pop() ?? path;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      vaultPath: null,
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

      setVault: (path) => {
        const name = path.split('/').pop() ?? path;
        const { recentVaults } = get();
        const updated = [
          { path, name, lastOpened: Date.now() },
          ...recentVaults.filter((v) => v.path !== path),
        ].slice(0, 10);
        set({ vaultPath: path, recentVaults: updated });
      },

      closeVault: () =>
        set({
          vaultPath: null,
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
        const { openTabs, activeTabId, splitTabId } = get();
        const idx = openTabs.findIndex((t) => t.id === id);
        const next = openTabs.filter((t) => t.id !== id);
        let newActive = activeTabId;
        if (activeTabId === id) {
          const prev = next[Math.min(idx, next.length - 1)];
          newActive = prev?.id ?? null;
        }
        const newSplit = splitTabId === id ? null : splitTabId;
        set({ openTabs: next, activeTabId: newActive, splitTabId: newSplit });
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
    }),
    {
      name: 'blueprints-workspace',
      partialize: (state) => ({
        vaultPath: state.vaultPath,
        openTabs: state.openTabs.map((t) => ({ ...t, isDirty: false })),
        activeTabId: state.activeTabId,
        sidebarWidth: state.sidebarWidth,
        sidebarCollapsed: state.sidebarCollapsed,
        recentFiles: state.recentFiles,
        recentVaults: state.recentVaults,
        sortMode: state.sortMode,
        foldersFirst: state.foldersFirst,
        pinnedFiles: state.pinnedFiles,
      }),
    },
  ),
);
