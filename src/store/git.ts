import { create } from 'zustand';
import {
  GitService,
  type GitFileStatus,
  type GitLogEntry,
  type GitBranchInfo,
} from '../services/git';

interface GitState {
  files: GitFileStatus[];
  log: GitLogEntry[];
  branches: GitBranchInfo | null;
  loading: boolean;
  error: string | null;
  selectedFile: string | null;
  selectedDiff: string | null;
  diffStaged: boolean;

  refresh: () => Promise<void>;
  refreshLog: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  selectFile: (path: string, staged: boolean) => Promise<void>;
  clearSelection: () => void;
  stage: (path: string) => Promise<void>;
  unstage: (path: string) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  commit: (message: string) => Promise<string>;
  discard: (path: string) => Promise<void>;
}

export const useGitStore = create<GitState>((set, get) => ({
  files: [],
  log: [],
  branches: null,
  loading: false,
  error: null,
  selectedFile: null,
  selectedDiff: null,
  diffStaged: false,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const files = await GitService.status();
      set({ files, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  refreshLog: async () => {
    try {
      const log = await GitService.log(30);
      set({ log });
    } catch {
      // ignore - might not have commits yet
    }
  },

  refreshBranches: async () => {
    try {
      const branches = await GitService.branches();
      set({ branches });
    } catch {
      // ignore
    }
  },

  selectFile: async (path, staged) => {
    set({ selectedFile: path, diffStaged: staged, selectedDiff: null });
    try {
      const diff = await GitService.diff(path, staged);
      set({ selectedDiff: diff });
    } catch (err) {
      set({ selectedDiff: `Error loading diff: ${err}` });
    }
  },

  clearSelection: () => set({ selectedFile: null, selectedDiff: null }),

  stage: async (path) => {
    await GitService.stage(path);
    await get().refresh();
    // Re-select if same file
    if (get().selectedFile === path) {
      await get().selectFile(path, true);
    }
  },

  unstage: async (path) => {
    await GitService.unstage(path);
    await get().refresh();
    if (get().selectedFile === path) {
      await get().selectFile(path, false);
    }
  },

  stageAll: async () => {
    await GitService.stageAll();
    await get().refresh();
  },

  unstageAll: async () => {
    await GitService.unstageAll();
    await get().refresh();
  },

  commit: async (message) => {
    const oid = await GitService.commit(message);
    await get().refresh();
    await get().refreshLog();
    return oid;
  },

  discard: async (path) => {
    await GitService.discard(path);
    await get().refresh();
    if (get().selectedFile === path) {
      set({ selectedFile: null, selectedDiff: null });
    }
  },
}));
