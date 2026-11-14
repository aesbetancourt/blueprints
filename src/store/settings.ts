import { create } from 'zustand';
import { createTauriStore } from '@tauri-store/zustand';
import { IMAGE_INCLUDE_PATTERNS } from '../utils/imageFiles';

export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  tabSize: number;
  wordWrap: boolean;
}

export interface FileSettings {
  defaultFileType: 'md' | 'excalidraw' | 'mermaid' | 'json';
  includePatterns: string[]; // only files matching these patterns are shown
  hiddenPaths: string[]; // folder/file names hidden from file explorer
  jsonGraphMaxSizeKB: number; // JSON files above this size skip graph visualization
}

export interface TokenSettings {
  charsPerToken: number;
}

export interface QuickNoteSettings {
  nameTemplate: string; // supports {date}, {time}, {timestamp}, {iso}
  folder: string; // relative to vault root
}

export interface ShortcutBinding {
  id: string;
  label: string;
  keys: string; // e.g. "CmdOrCtrl+Shift+F"
}

export interface FileTag {
  id: string;
  label: string;
  color: string; // tailwind-friendly color key or hex
}

export interface SettingsState {
  editor: EditorSettings;
  file: FileSettings;
  token: TokenSettings;
  quickNote: QuickNoteSettings;
  shortcuts: ShortcutBinding[];
  tags: FileTag[];
  fileTags: Record<string, string[]>; // path -> tag ids
  variables: Record<string, string>; // user-defined template variables

  updateEditor: (partial: Partial<EditorSettings>) => void;
  updateFile: (partial: Partial<FileSettings>) => void;
  updateToken: (partial: Partial<TokenSettings>) => void;
  updateQuickNote: (partial: Partial<QuickNoteSettings>) => void;
  updateShortcut: (id: string, keys: string) => void;
  addTag: (tag: FileTag) => void;
  removeTag: (id: string) => void;
  assignTag: (path: string, tagId: string) => void;
  unassignTag: (path: string, tagId: string) => void;
  setVariable: (key: string, value: string) => void;
  removeVariable: (key: string) => void;
  resetAll: () => void;
}

const DEFAULT_EDITOR: EditorSettings = {
  fontSize: 15,
  fontFamily: "'Inter', system-ui, sans-serif",
  lineHeight: 1.75,
  tabSize: 2,
  wordWrap: true,
};

const DEFAULT_FILE: FileSettings = {
  defaultFileType: 'md',
  includePatterns: [
    '*.md',
    '*.excalidraw',
    '*.mermaid',
    '*.json',
    '*.yaml',
    '*.yml',
    '*.xml',
    '*.csv',
    ...IMAGE_INCLUDE_PATTERNS,
  ],
  hiddenPaths: [],
  jsonGraphMaxSizeKB: 500,
};

const DEFAULT_TOKEN: TokenSettings = {
  charsPerToken: 4,
};

const DEFAULT_QUICK_NOTE: QuickNoteSettings = {
  nameTemplate: 'note-{date}-{time}',
  folder: 'inbox',
};

const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { id: 'command-palette', label: 'Command Palette', keys: '⌘P' },
  { id: 'search-files', label: 'Search in Files', keys: '⌘⇧F' },
  { id: 'find-in-file', label: 'Find in File', keys: '⌘F' },
  { id: 'new-file', label: 'New File', keys: '⌘N' },
  { id: 'toggle-sidebar', label: 'Toggle Sidebar', keys: '⌘B' },
  { id: 'close-tab', label: 'Close Tab', keys: '⌘W' },
  { id: 'prev-tab', label: 'Previous Tab', keys: '⌘⇧[' },
  { id: 'next-tab', label: 'Next Tab', keys: '⌘⇧]' },
  { id: 'settings', label: 'Settings', keys: '⌘,' },
];

const DEFAULT_TAGS: FileTag[] = [
  { id: 'important', label: 'Important', color: '#ef4444' },
  { id: 'wip', label: 'WIP', color: '#f59e0b' },
  { id: 'review', label: 'Review', color: '#8b5cf6' },
  { id: 'done', label: 'Done', color: '#22c55e' },
  { id: 'blocked', label: 'Blocked', color: '#ec4899' },
];

const DEFAULT_VARIABLES: Record<string, string> = {
  author: '',
  project: '',
};

export const useSettingsStore = create<SettingsState>()((set) => ({
  editor: DEFAULT_EDITOR,
  file: DEFAULT_FILE,
  token: DEFAULT_TOKEN,
  quickNote: DEFAULT_QUICK_NOTE,
  shortcuts: DEFAULT_SHORTCUTS,
  tags: DEFAULT_TAGS,
  fileTags: {},
  variables: DEFAULT_VARIABLES,

  updateEditor: (partial) => set((s) => ({ editor: { ...s.editor, ...partial } })),

  updateFile: (partial) => set((s) => ({ file: { ...s.file, ...partial } })),

  updateToken: (partial) => set((s) => ({ token: { ...s.token, ...partial } })),

  updateQuickNote: (partial) => set((s) => ({ quickNote: { ...s.quickNote, ...partial } })),

  updateShortcut: (id, keys) =>
    set((s) => ({
      shortcuts: s.shortcuts.map((sc) => (sc.id === id ? { ...sc, keys } : sc)),
    })),

  addTag: (tag) => set((s) => ({ tags: [...s.tags, tag] })),

  removeTag: (id) =>
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== id),
      fileTags: Object.fromEntries(
        Object.entries(s.fileTags).map(([path, ids]) => [path, ids.filter((tid) => tid !== id)]),
      ),
    })),

  assignTag: (path, tagId) =>
    set((s) => {
      const current = s.fileTags[path] ?? [];
      if (current.includes(tagId)) return s;
      return { fileTags: { ...s.fileTags, [path]: [...current, tagId] } };
    }),

  unassignTag: (path, tagId) =>
    set((s) => {
      const current = s.fileTags[path] ?? [];
      const updated = current.filter((id) => id !== tagId);
      if (updated.length === 0) {
        return {
          fileTags: Object.fromEntries(Object.entries(s.fileTags).filter(([key]) => key !== path)),
        };
      }
      return { fileTags: { ...s.fileTags, [path]: updated } };
    }),

  setVariable: (key, value) => set((s) => ({ variables: { ...s.variables, [key]: value } })),

  removeVariable: (key) =>
    set((s) => ({
      variables: Object.fromEntries(Object.entries(s.variables).filter(([k]) => k !== key)),
    })),

  resetAll: () =>
    set({
      editor: DEFAULT_EDITOR,
      file: DEFAULT_FILE,
      token: DEFAULT_TOKEN,
      quickNote: DEFAULT_QUICK_NOTE,
      shortcuts: DEFAULT_SHORTCUTS,
      tags: DEFAULT_TAGS,
      fileTags: {},
      variables: DEFAULT_VARIABLES,
    }),
}));

// Tauri Store handler — persists settings to disk
// On hydration: deep-merges nested objects, migrates includePatterns
export const settingsStoreHandler = createTauriStore(
  'settings',
  useSettingsStore as unknown as import('zustand').StoreApi<Record<string, unknown>>,
  {
    autoStart: false,
    saveOnChange: true,
    saveStrategy: 'debounce',
    saveInterval: 1000,
    filterKeys: [
      'editor',
      'file',
      'token',
      'quickNote',
      'shortcuts',
      'tags',
      'fileTags',
      'variables',
    ],
    filterKeysStrategy: 'pick',
    hooks: {
      beforeFrontendSync: (state) => {
        // Deep-merge nested settings objects with defaults
        if (state.editor) {
          state.editor = { ...DEFAULT_EDITOR, ...(state.editor as EditorSettings) };
        }
        if (state.file) {
          state.file = { ...DEFAULT_FILE, ...(state.file as FileSettings) };
          // Migrate: ensure all supported patterns exist
          const required = [
            '*.json',
            '*.yaml',
            '*.yml',
            '*.xml',
            '*.csv',
            ...IMAGE_INCLUDE_PATTERNS,
          ];
          const patterns = (state.file as FileSettings).includePatterns ?? [];
          const missing = required.filter((p) => !patterns.includes(p));
          if (missing.length > 0) {
            (state.file as FileSettings).includePatterns = [...patterns, ...missing];
          }
        }
        if (state.token) {
          state.token = { ...DEFAULT_TOKEN, ...(state.token as TokenSettings) };
        }
        if (state.quickNote) {
          state.quickNote = { ...DEFAULT_QUICK_NOTE, ...(state.quickNote as QuickNoteSettings) };
        }
        if (state.variables) {
          state.variables = {
            ...DEFAULT_VARIABLES,
            ...(state.variables as Record<string, string>),
          };
        }
        return state;
      },
      error: (err) => {
        console.error('[settings store]', err);
      },
    },
  },
);
