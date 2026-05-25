# Architecture

Blueprints is a vault-based markdown editor and software spec system. It runs as a native desktop app using Tauri v2 (Rust backend) with a React 19 frontend rendered in the OS WebView.

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Technology Stack](#technology-stack)
3. [Directory Structure](#directory-structure)
4. [Application Lifecycle](#application-lifecycle)
5. [Frontend Architecture](#frontend-architecture)
6. [State Management](#state-management)
7. [Editor System](#editor-system)
8. [Tauri IPC Bridge](#tauri-ipc-bridge)
9. [Rust Backend](#rust-backend)
10. [Filesystem Watcher](#filesystem-watcher)
11. [File Operations & Caching](#file-operations--caching)
12. [Save System](#save-system)
13. [Git Integration](#git-integration)
14. [Security Model](#security-model)
15. [Keyboard Shortcuts](#keyboard-shortcuts)
16. [Patterns & Conventions](#patterns--conventions)
17. [Data Flow Diagrams](#data-flow-diagrams)

---

## High-Level Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        macOS / Windows / Linux                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Tauri Native Window                       │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │               WebView (React 19 SPA)                    │  │  │
│  │  │                                                         │  │  │
│  │  │  ┌─────────┬──────────────────────────────────────┐    │  │  │
│  │  │  │Sidebar  │ Editor Area                           │    │  │  │
│  │  │  │         │ ┌──────────────────────────────────┐  │    │  │  │
│  │  │  │ Files   │ │ TabBar                           │  │    │  │  │
│  │  │  │ ToC     │ │ Breadcrumbs (mode toggle)        │  │    │  │  │
│  │  │  │ Tags    │ │ EditorPane                       │  │    │  │  │
│  │  │  │ Links   │ │   ├─ MarkdownEditor (TipTap v3)  │  │    │  │  │
│  │  │  │ Notes   │ │   ├─ ExcalidrawEditor             │  │    │  │  │
│  │  │  │ Inbox   │ │   └─ MermaidEditor                │  │    │  │  │
│  │  │  │         │ └──────────────────────────────────┘  │    │  │  │
│  │  │  └─────────┴──────────────────────────────────────┘    │  │  │
│  │  │  └─ StatusBar ─────────────────────────────────────┘    │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  │          invoke() ─────────────────┐                          │  │
│  │          listen() ◄────────────────┼──── emit()               │  │
│  │                                    │                          │  │
│  │  ┌────────────────────────────────┐│                          │  │
│  │  │         Rust Backend           ││                          │  │
│  │  │                                ▼│                          │  │
│  │  │  ┌─────────────────────────────┐│                          │  │
│  │  │  │ Commands (IPC handlers)      ││                          │  │
│  │  │  │  ├─ vault.rs  (init)        ││                          │  │
│  │  │  │  ├─ files.rs  (CRUD/search) ││                          │  │
│  │  │  │  ├─ git.rs    (git2 ops)    ││                          │  │
│  │  │  │  └─ system.rs (sysinfo)     ││                          │  │
│  │  │  └─────────────────────────────┘│                          │  │
│  │  │  ┌─────────────────────────────┐│                          │  │
│  │  │  │ Watcher (notify crate)      ││                          │  │
│  │  │  │  → emits fs:created/mod/del ││                          │  │
│  │  │  └─────────────────────────────┘│                          │  │
│  │  │  ┌─────────────────────────────┐│                          │  │
│  │  │  │ AppState { vault_path }      ││                          │  │
│  │  │  └─────────────────────────────┘│                          │  │
│  │  └────────────────────────────────┘│                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           ▼                                         │
│              Local Filesystem (vault directory)                      │
└────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer    | Technology             | Version      | Purpose                            |
| -------- | ---------------------- | ------------ | ---------------------------------- |
| Runtime  | Tauri                  | 2            | Native window, IPC, plugins        |
| Frontend | React                  | 19           | UI components                      |
| Bundler  | Vite                   | 8            | Dev server, HMR, production builds |
| Styling  | Tailwind CSS           | 4            | Utility-first dark theme           |
| State    | Zustand                | 5            | Global stores with persistence     |
| Editor   | TipTap                 | 3.23.6       | Rich text (ProseMirror-based)      |
| Markdown | tiptap-markdown        | 0.9.0        | Markdown ↔ ProseMirror             |
| Drawings | Excalidraw             | 0.18.1       | Canvas-based diagrams              |
| Diagrams | Mermaid                | 11.15.0      | Text → diagram rendering           |
| Panels   | react-resizable-panels | 4.11.1       | Resizable layout splits            |
| Palette  | cmdk                   | 1.1.1        | Command palette component          |
| Backend  | Rust                   | 2021 edition | Native operations                  |
| Git      | git2                   | 0.19         | libgit2 bindings                   |
| FS Watch | notify                 | 7            | Cross-platform file events         |
| System   | sysinfo                | 0.33         | Process/memory stats               |
| Trash    | trash                  | 5            | OS-native file deletion            |

---

## Directory Structure

```
blueprints/
├── src/                              # ── FRONTEND ──
│   ├── main.tsx                      # Entry: mounts <App/> into #root
│   ├── App.tsx                       # Just renders <Shell/>
│   ├── index.ts                      # (unused barrel)
│   ├── vite-env.d.ts                 # Vite type declarations
│   │
│   ├── components/                   # UI Components
│   │   ├── Shell.tsx                 # Root layout — wires all panels, modals, shortcuts
│   │   ├── Sidebar.tsx               # Left panel: tabs for Files/ToC/Tags/Backlinks/Annotations
│   │   ├── EditorArea.tsx            # Center: TabBar + Breadcrumbs + EditorPane (split support)
│   │   ├── EditorPane.tsx            # File loader, save manager, dirty tracking
│   │   ├── TabBar.tsx                # Tab strip with close/dirty indicators
│   │   ├── Breadcrumbs.tsx           # Path display + Rich/Raw mode toggle
│   │   ├── StatusBar.tsx             # Bottom: file info, stats, panel toggle buttons
│   │   ├── FileExplorer.tsx          # File tree + context menu + include-pattern filtering
│   │   ├── GitPanel.tsx              # Git status/diff/stage/commit
│   │   ├── SearchPanel.tsx           # Workspace search (content + filename modes)
│   │   ├── CommandPalette.tsx        # Cmd+P quick file open (cmdk)
│   │   ├── CreateModal.tsx           # New file/folder with template picker
│   │   ├── SettingsModal.tsx         # Preferences (editor, files, tokens, shortcuts)
│   │   ├── HelpPanel.tsx             # 8-section help reference
│   │   ├── ResourcePanel.tsx         # CPU/memory sparkline graphs
│   │   ├── ScratchPad.tsx            # Floating resizable notepad
│   │   ├── TableOfContents.tsx       # Heading-based document outline
│   │   ├── BacklinksPanel.tsx        # Shows which files link to current file
│   │   ├── TagsPanel.tsx             # Tag management and file grouping
│   │   ├── AnnotationsPanel.tsx      # File annotations/highlights
│   │   ├── InboxSection.tsx          # Quick-capture inbox folder
│   │   ├── KeyboardShortcuts.tsx     # Shortcuts reference modal
│   │   ├── ConfirmDialog.tsx         # Custom confirm() — replaces window.confirm
│   │   ├── VaultSelector.tsx         # Landing screen — vault picker
│   │   ├── VaultErrorModal.tsx       # Error state for vault issues
│   │   └── Toast.tsx                 # Notification system
│   │
│   ├── editors/                      # Editor Implementations
│   │   ├── MarkdownEditor.tsx        # TipTap rich/raw markdown editor
│   │   ├── MarkdownToolbar.tsx       # Formatting buttons (bold, link, table, etc.)
│   │   ├── ExcalidrawEditor.tsx      # Excalidraw canvas wrapper
│   │   ├── MermaidEditor.tsx         # Mermaid text + live preview
│   │   ├── FindBar.tsx               # In-editor Cmd+F search/replace
│   │   ├── TableControls.tsx         # Table row/col manipulation
│   │   └── extensions/               # TipTap Custom Extensions
│   │       ├── SlashCommands.tsx     # "/" menu — insert templates, headings, blocks
│   │       ├── WikiLink.ts           # [[wiki-link]] ProseMirror node
│   │       ├── WikiLinkSuggestion.tsx # Autocomplete popup for [[ links
│   │       └── MermaidBlock.tsx      # Fenced code block → rendered diagram
│   │
│   ├── store/                        # Zustand State Stores
│   │   ├── workspace.ts             # Vault, file tree, tabs, sidebar, pinned, sorting
│   │   ├── settings.ts             # Editor/file/token prefs, tags, shortcuts (persisted)
│   │   ├── git.ts                   # Git state and actions
│   │   └── annotations.ts          # File annotations (persisted)
│   │
│   ├── services/                    # Tauri IPC Wrappers
│   │   ├── vault.ts                # File ops: read, write, create, delete, search, tags
│   │   └── git.ts                  # Git ops: status, diff, stage, commit, log, branches
│   │
│   ├── hooks/                       # React Hooks
│   │   ├── useFileEvents.ts        # Listens to fs:created/modified/deleted events
│   │   ├── useVaultInit.ts         # Opens vault + loads file tree on app start
│   │   └── useHotkey.ts            # Single key+meta shortcut binding
│   │
│   ├── utils/
│   │   └── mapFileEntries.ts       # Rust snake_case → store camelCase adapter
│   │
│   ├── data/                        # Static data (templates, etc.)
│   ├── styles/
│   │   └── globals.css             # Tailwind imports + CSS custom properties
│   └── assets/                      # Static assets (icons, images)
│
├── src-tauri/                        # ── RUST BACKEND ──
│   ├── src/
│   │   ├── main.rs                  # Entry point → calls lib::run()
│   │   ├── lib.rs                   # Tauri builder: plugins, state, menu, commands
│   │   ├── watcher.rs              # FS watcher thread (notify → emit events)
│   │   └── commands/
│   │       ├── mod.rs              # Module declarations
│   │       ├── vault.rs            # open_vault: validates dir, stores path, starts watcher
│   │       ├── files.rs            # CRUD, search, tags, archive, move (with path validation)
│   │       ├── git.rs              # Full git workflow via git2
│   │       └── system.rs           # Process CPU/memory via sysinfo
│   ├── Cargo.toml                   # Rust dependencies
│   ├── build.rs                     # Tauri build script
│   ├── tauri.conf.json             # Window config, build commands, security, bundling
│   ├── capabilities/
│   │   └── default.json            # Plugin permission grants
│   └── icons/                       # App icons for all platforms
│
├── docs/                            # Documentation
│   ├── ARCHITECTURE.md             # This file
│   └── TAURI.md                    # Tauri-specific guide
├── AGENTS.md                        # AI agent conventions
├── package.json                     # Frontend dependencies + scripts
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite build configuration
├── tailwind.config.ts              # Tailwind theme tokens
├── eslint.config.js                # ESLint rules
└── knip.config.ts                  # Unused code detection config
```

---

## Application Lifecycle

### Startup Sequence

```
1. pnpm tauri dev
   ├─ Vite starts → http://localhost:5173
   └─ Cargo builds + launches native window pointing at Vite

2. Window loads → main.tsx
   └─ createRoot(#root).render(<App/>)
       └─ <Shell/>
           ├─ Checks vaultPath from persisted workspace store
           │   ├─ null → renders <VaultSelector/> (landing screen)
           │   └─ exists → renders full app layout
           ├─ useVaultInit() hook fires:
           │   ├─ invoke('open_vault', { path }) → Rust validates dir, stores in AppState
           │   │   └─ Rust starts filesystem watcher thread
           │   └─ invoke('list_files', { path }) → Rust builds file tree
           │       └─ setFileTree(mapFileEntries(tree))
           ├─ useFileEvents() hook subscribes to fs:created/modified/deleted
           └─ Keyboard shortcuts registered via useEffect in Shell
```

### Vault Opening

```
User clicks "Open Vault" in VaultSelector
    │
    ▼
@tauri-apps/plugin-dialog → native folder picker
    │
    ▼
workspace.setVault(selectedPath) → persisted to localStorage
    │
    ▼
Shell re-renders → full app layout appears
    │
    ▼
useVaultInit() fires → open_vault IPC → watcher starts
    │
    ▼
list_files IPC → file tree rendered in sidebar
```

### File Opening

```
User clicks file in FileExplorer (or CommandPalette, or double-click)
    │
    ▼
workspace.openFile(path)
    ├─ If tab already open → set activeTabId (no new tab)
    ├─ Creates Tab { id: path, filePath, fileName, fileType, isDirty: false }
    ├─ Adds to openTabs, sets activeTabId
    ├─ Updates recentFiles
    └─ Kicks off VaultService.readFile(path) to warm cache
    │
    ▼
EditorArea renders <EditorPane key={tab.id} tab={tab} editorMode={mode}/>
    │  (key={tab.id} → full remount per tab)
    │
    ▼
EditorPane mounts:
    ├─ Checks VaultService._cache for instant content (no flash)
    ├─ If cached → useState initializes with content, editor renders immediately
    ├─ If not cached → empty div (no loading text), IPC fires, content arrives in ~16ms
    └─ Renders MarkdownEditor / ExcalidrawEditor / MermaidEditor based on fileType
```

---

## Frontend Architecture

### Component Hierarchy

```
<App>
  └─ <Shell>                               # Root layout controller
      ├─ <Group horizontal>                # react-resizable-panels
      │   ├─ <Panel> <Sidebar/>            # Left panel (collapsible via Cmd+B)
      │   │   ├─ Tab: Files → <FileExplorer/>
      │   │   ├─ Tab: ToC → <TableOfContents/>
      │   │   ├─ Tab: Tags → <TagsPanel/>
      │   │   ├─ Tab: Links → <BacklinksPanel/>
      │   │   ├─ Tab: Notes → <AnnotationsPanel/>
      │   │   └─ Section: <InboxSection/>
      │   ├─ <Separator/>
      │   ├─ <Panel> <EditorArea/>         # Center
      │   │   ├─ <TabBar/>
      │   │   ├─ <Breadcrumbs/>
      │   │   └─ <EditorPane key={id}/>    # Per-tab instance
      │   │       ├─ <MarkdownEditor/>
      │   │       │   ├─ <MarkdownToolbar/>
      │   │       │   ├─ <EditorContent/> (TipTap)
      │   │       │   └─ <FindBar/>
      │   │       ├─ <ExcalidrawEditor/>
      │   │       └─ <MermaidEditor/>
      │   ├─ <Separator/> (if git open)
      │   └─ <Panel> <GitPanel/>           # Right panel (toggle)
      ├─ <ScratchPad/>                     # Floating overlay
      ├─ <StatusBar/>                      # Bottom bar
      ├─ <CommandPalette/>                 # Cmd+P overlay
      ├─ <SearchPanel/>                    # Cmd+Shift+F overlay
      ├─ <SettingsModal/>                  # Cmd+, overlay
      ├─ <CreateModal/>                    # Cmd+N overlay
      ├─ <HelpPanel/>                      # Help overlay
      ├─ <ResourcePanel/>                  # Resource monitor overlay
      ├─ <KeyboardShortcuts/>              # Shortcuts reference
      ├─ <ToastContainer/>                 # Toast notifications
      └─ <ConfirmDialog/>                  # Modal confirm dialogs
```

### Panel Management

All panels/modals are controlled by boolean state in `Shell.tsx`:

```typescript
const [paletteOpen, setPaletteOpen] = useState(false);
const [searchOpen, setSearchOpen] = useState(false);
const [gitPanelOpen, setGitPanelOpen] = useState(false);
const [scratchPadOpen, setScratchPadOpen] = useState(false);
// ... etc
```

They're toggled via:

- Keyboard shortcuts (registered in Shell's useEffect)
- StatusBar icon buttons (callbacks passed as props)
- Each modal/panel receives `open` + `onClose` props

### Resizable Layout

Uses `react-resizable-panels` for the three-column layout:

```
┌──────────┬─────────────────────────────┬──────────┐
│  Sidebar │       Editor Area           │ Git Panel│
│   20%    │         flex-1              │   22%    │
│  min:330px│        min:40%             │  min:15% │
│  max:35% │                             │  max:40% │
└──────────┴─────────────────────────────┴──────────┘
```

Sidebar and Git panel are conditionally rendered (not just hidden).

---

## State Management

### Store Architecture

All stores use Zustand with TypeScript interfaces:

```
┌─────────────────────┐    ┌──────────────────────┐
│   workspace.ts      │    │    settings.ts        │
│   (persisted)       │    │    (persisted)        │
├─────────────────────┤    ├──────────────────────┤
│ vaultPath           │    │ editor: { fontSize,   │
│ fileTree            │    │   lineHeight, ... }   │
│ openTabs            │    │ file: { include... }  │
│ activeTabId         │    │ token: { charsPerT }  │
│ splitTabId          │    │ quickNote: { folder,  │
│ recentFiles         │    │   nameTemplate }      │
│ pinnedFiles         │    │ tags: FileTag[]       │
│ sidebarCollapsed    │    │ shortcuts: binding[]  │
│ sortMode            │    └──────────────────────┘
│ documentStats       │
│ recentVaults        │    ┌──────────────────────┐
└─────────────────────┘    │     git.ts           │
                           │   (not persisted)     │
┌─────────────────────┐    ├──────────────────────┤
│  annotations.ts     │    │ files: GitFileStatus[]│
│   (persisted)       │    │ log: GitLogEntry[]    │
├─────────────────────┤    │ branches: BranchInfo  │
│ annotations[]       │    │ selectedFile          │
│ { filePath,         │    │ selectedDiff          │
│   anchorText,       │    └──────────────────────┘
│   content, color }  │
└─────────────────────┘
```

### Persistence Strategy

```typescript
// workspace.ts — selective persistence (partialize)
persist(
  (set, get) => ({ ... }),
  {
    name: 'blueprints-workspace',
    partialize: (state) => ({
      vaultPath: state.vaultPath,
      openTabs: state.openTabs.map(t => ({ ...t, isDirty: false })),
      activeTabId: state.activeTabId,
      recentFiles: state.recentFiles,
      pinnedFiles: state.pinnedFiles,
      sidebarCollapsed: state.sidebarCollapsed,
      sortMode: state.sortMode,
      recentVaults: state.recentVaults,
    }),
  }
)

// settings.ts — deep merge on hydration
persist(
  (set, get) => ({ ... }),
  {
    name: 'blueprints-settings',
    merge: (persisted, current) => {
      const p = persisted as Partial<SettingsState>;
      return {
        ...current,
        editor: { ...current.editor, ...(p.editor ?? {}) },
        file: { ...current.file, ...(p.file ?? {}) },
        token: { ...current.token, ...(p.token ?? {}) },
        quickNote: { ...current.quickNote, ...(p.quickNote ?? {}) },
        tags: p.tags ?? current.tags,
        shortcuts: p.shortcuts ?? current.shortcuts,
      };
    },
  }
)
```

**Why deep merge?** When new settings fields are added in code, persisted state from localStorage won't have them. Shallow spread would wipe nested defaults. The custom `merge` function ensures new defaults coexist with saved preferences.

### Hydration Safety Pattern

```typescript
// Always use fallbacks when reading persisted arrays/booleans:
const includePatterns = useSettingsStore((s) => s.file.includePatterns) ?? [
  '*.md',
  '*.excalidraw',
  '*.mermaid',
];
const pinnedFiles = useWorkspaceStore((s) => s.pinnedFiles) ?? [];
```

This prevents crashes when the persisted shape doesn't match (e.g., first run after adding a field).

---

## Editor System

### TipTap Configuration

```typescript
const editor = useEditor({
  extensions: [
    StarterKit.configure({ codeBlock: false }),  // Disable default, use MermaidCodeBlock
    MermaidCodeBlock,                             // Custom fenced code with mermaid rendering
    Link.configure({ openOnClick: false }),       // Links handled manually
    Table.configure({ resizable: true }),
    TableRow, TableCell, TableHeader,
    TaskList, TaskItem.configure({ nested: true }),
    Placeholder.configure({ ... }),
    Markdown.configure({ html: false }),          // MD ↔ ProseMirror
    WikiLink,                                     // [[link]] node type
    WikiLinkSuggestion,                          // Autocomplete for [[
    SlashCommands,                               // / menu at start of line
  ],
  content,                    // Initial markdown string
  immediatelyRender: true,    // No hydration flash
  shouldRerenderOnTransaction: true,  // React stays in sync
  onCreate: ({ editor }) => {
    // Normalize: get canonical markdown after ProseMirror processes it
    const md = editor.storage.markdown.getMarkdown();
    onChange(md);  // Updates contentRef in EditorPane (baseline)
  },
  onUpdate: ({ editor }) => {
    // Skip initialization updates (normalization)
    if (!isInitializedRef.current) return;
    const md = editor.storage.markdown.getMarkdown();
    onUserEdit(md);  // Marks dirty, triggers save on blur
  },
});
```

### Initialization Guard

TipTap fires `onUpdate` during content initialization (normalization). Without a guard, this marks the file as dirty immediately on open. The fix:

```typescript
const isInitializedRef = useRef(false);

onCreate: () => {
  // ... normalize
  requestAnimationFrame(() => { isInitializedRef.current = true; });
},
onUpdate: () => {
  if (!isInitializedRef.current) return;  // Skip init updates
  // ... handle real user edits
},
```

### Editor Modes

```
┌─────────────────────────────────────────┐
│ Breadcrumbs   [path/to/file.md]  [R|W]  │  ← Mode toggle
├─────────────────────────────────────────┤
│                                          │
│  Rich mode: TipTap WYSIWYG + Toolbar    │  ← Full formatting
│    OR                                    │
│  Raw mode: <textarea> with monospace     │  ← Direct markdown
│                                          │
└─────────────────────────────────────────┘
```

Mode state lives in `EditorArea` (not per-tab — switching mode affects the active view, and switching tabs resets to 'rich'). When mode changes:

- Rich → Raw: extract markdown from TipTap, set as textarea value
- Raw → Rich: push textarea content back into TipTap

### Custom Extensions

| Extension            | Plugin Key                 | Trigger              | Behavior                                           |
| -------------------- | -------------------------- | -------------------- | -------------------------------------------------- |
| `SlashCommands`      | `slashCommandsPlugin`      | `/` at line start    | Shows dropdown of templates, headings, code blocks |
| `WikiLink`           | —                          | Renders `[[target]]` | Inline node with click-to-open-file                |
| `WikiLinkSuggestion` | `wikiLinkSuggestionPlugin` | `[[` + typing        | Autocomplete popup listing vault files             |
| `MermaidBlock`       | —                          | ` ```mermaid `       | Renders Mermaid diagram below code                 |

Each Suggestion-based extension **must** have a unique `PluginKey` — ProseMirror throws if two plugins share a key.

### Toolbar Link Button

The link button uses an inline `<input>` (not `window.prompt`, which is blocked in WebView):

```typescript
// Click link button → show inline URL input
// Type URL → Enter submits, Escape cancels
// Auto-prepends https:// if missing protocol
// Clicking an existing link removes it
```

### Link Click Handling

```typescript
const handleClick = (e: React.MouseEvent) => {
  // 1. Wiki links → open file in vault
  const wikiEl = target.closest('[data-wiki-link]');
  if (wikiEl) {
    openFile(href);
    return;
  }

  // 2. External links → open in system browser (not WebView!)
  const anchor = target.closest('a');
  if (anchor && /^https?:\/\//.test(anchor.href)) {
    e.preventDefault();
    open(anchor.href); // @tauri-apps/plugin-shell
  }
};
```

---

## Tauri IPC Bridge

### Commands (Frontend → Backend)

The frontend calls Rust functions via `invoke()`:

```typescript
// Frontend (TypeScript)
import { invoke } from '@tauri-apps/api/core';
const content = await invoke<string>('read_file', { path: '/path/to/file.md' });
```

```rust
// Backend (Rust)
#[command]
pub async fn read_file(path: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    validate_path(&path, &vault_root)?;
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
```

**Parameter mapping:** Frontend sends camelCase JSON → Tauri auto-converts to snake_case for Rust.

### Events (Backend → Frontend)

Rust emits events that the frontend subscribes to:

```rust
// Backend
app_handle.emit("fs:modified", &FsEvent { path: "..." })?;
```

```typescript
// Frontend
import { listen } from '@tauri-apps/api/event';
const unlisten = await listen<{ path: string }>('fs:modified', (event) => {
  refreshFileTree();
});
```

### Service Layer Pattern

All IPC calls are wrapped in service objects — components never call `invoke()` directly:

```typescript
// src/services/vault.ts
export const VaultService = {
  async readFile(path: string): Promise<string> {
    const content = await invoke<string>('read_file', { path });
    this._cache.set(path, content); // Cache for instant re-opens
    return content;
  },
  // ...
};

// src/services/git.ts
export const GitService = {
  async status(): Promise<GitFileStatus[]> {
    return invoke<GitFileStatus[]>('git_status');
  },
  // ...
};
```

### Type Adapter (mapFileEntries)

Rust returns `is_directory` (snake_case) but the store uses `isDirectory` (camelCase):

```typescript
// src/utils/mapFileEntries.ts
export function mapFileEntries(entries: RustFileEntry[]): StoreFileEntry[] {
  return entries.map((e) => ({
    name: e.name,
    path: e.path,
    isDirectory: e.is_directory, // ← conversion happens here
    children: e.children ? mapFileEntries(e.children) : undefined,
  }));
}
```

---

## Rust Backend

### App Initialization (`lib.rs`)

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())       // URL opening
        .plugin(tauri_plugin_dialog::init())      // Native file dialogs
        .manage(AppState { vault_path: Mutex::new(None) })  // Shared state
        .setup(|app| {
            // Custom menu (omits Cmd+N to avoid intercepting app shortcut)
            let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &window_menu])?;
            app.set_menu(menu)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 19 registered commands
            commands::vault::open_vault,
            commands::files::list_files,
            commands::files::read_file,
            // ... all others
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### AppState

Single shared state struct, wrapped in Mutex for thread safety:

```rust
pub struct AppState {
    pub vault_path: Mutex<Option<String>>,
}
```

Every file/git command extracts the vault path from state and validates that requested paths are within the vault boundary.

### Command Registry

| Module      | Commands                                                                                                                                                                           | Purpose                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `vault.rs`  | `open_vault`                                                                                                                                                                       | Validate directory, store path, start watcher |
| `files.rs`  | `list_files`, `read_file`, `write_file`, `create_file`, `create_dir`, `archive_file`, `move_file`, `delete_file`, `rename_file`, `count_files_in_dir`, `search_files`, `scan_tags` | All file CRUD and search                      |
| `git.rs`    | `git_status`, `git_diff`, `git_stage`, `git_unstage`, `git_stage_all`, `git_unstage_all`, `git_commit`, `git_discard`, `git_log`, `git_branches`                                   | Full git workflow                             |
| `system.rs` | `get_system_stats`                                                                                                                                                                 | Process CPU/memory                            |

### Path Validation

Every file command validates that the target path is within the vault:

```rust
fn validate_path(path: &str, vault_root: &str) -> Result<(), String> {
    // For existing paths: canonicalize and check starts_with(root)
    // For new paths: canonicalize nearest existing ancestor
    // Prevents path traversal attacks (../../etc/passwd)
}
```

### File Tree Building

`list_files` recursively builds a sorted tree:

- Skips hidden files (`.` prefix)
- Skips common non-blueprint dirs (`node_modules`, `target`, `dist`, `build`)
- Sorts: directories first, then alphabetical (case-insensitive)

### Search Implementation

`search_files` does full-text search across the vault:

- Only searches `.md` and `.mermaid` files (skips excalidraw JSON noise)
- Case-insensitive substring matching
- Returns up to 100 results with path, line number, and line content
- Skips hidden files and common build directories

### Tag Scanning

`scan_tags` parses YAML frontmatter from all markdown files:

- Extracts `tags:` (array or inline list) and `status:` fields
- Returns `FileTagInfo { path, tags, status }` for each file with metadata
- Used by TagsPanel for tag-based file grouping

### Archive System

`archive_file` moves a file to `_archive/` preserving relative path structure:

- If markdown, injects `status: archived` into frontmatter before moving
- Creates `_archive/` subdirectories as needed

---

## Filesystem Watcher

### How It Works

```rust
// watcher.rs
pub fn start_watcher(app: &AppHandle, vault_path: &str) -> Result<(), String> {
    thread::spawn(move || {
        let watcher = notify::recommended_watcher(tx);
        watcher.watch(Path::new(&vault), RecursiveMode::Recursive);

        loop {
            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(Ok(event)) => {
                    match event.kind {
                        EventKind::Create(_) => emit("fs:created", path),
                        EventKind::Modify(_) => emit("fs:modified", path),
                        EventKind::Remove(_) => emit("fs:deleted", path),
                    }
                }
                Err(Disconnected) => break,  // App shutting down
                _ => {}  // Timeout — loop again
            }
        }
    });
}
```

### Frontend Response

```typescript
// useFileEvents.ts
useEffect(() => {
  const refresh = async () => {
    const tree = await VaultService.listFiles(vaultPath);
    setFileTree(mapFileEntries(tree));
  };
  listen('fs:created', refresh);
  listen('fs:modified', refresh);
  listen('fs:deleted', refresh);
}, [vaultPath]);
```

Any external change (e.g., editing a file in VS Code, git checkout) triggers an automatic file tree refresh.

---

## File Operations & Caching

### Content Cache

```typescript
// VaultService._cache: Map<string, string>
//
// Populated by: readFile() (every read stores result)
// Read by: EditorPane on mount (getCached(path))
// Invalidated by: invalidateCache(path) — for external changes
```

### Why Caching Matters

Without cache, opening a file has this timeline:

```
Mount → content=null → render empty → IPC call → ~16ms → content arrives → re-render
```

With cache:

```
Mount → content=cached → render editor immediately (zero flash)
```

The cache is warmed when `openFile()` is called in the workspace store (before EditorPane mounts):

```typescript
// workspace.ts openFile action:
set({ openTabs: [...openTabs, tab], activeTabId: tab.id });
VaultService.readFile(path).catch(() => {}); // Pre-fetch into cache
```

### Deferred Loading Indicator

If content isn't cached (first-ever open), a loading indicator only appears after 300ms:

```typescript
const loadingTimer = setTimeout(() => setShowLoading(true), 300);
// File reads complete in <50ms, so the timer never fires
```

---

## Save System

### Trigger Points

| Trigger     | How                        | When                                   |
| ----------- | -------------------------- | -------------------------------------- |
| Cmd+S       | `window.keydown` listener  | Explicit save                          |
| Focus out   | `container.focusout` event | Click outside editor                   |
| Window blur | `window.blur` event        | Switch to another app                  |
| Tab switch  | `useEffect` cleanup        | Component unmounts due to `key` change |
| Tab close   | `useEffect` cleanup        | Same as above                          |

### Dirty Tracking

```typescript
// EditorPane
const isDirtyRef = useRef(false); // Mutable flag — no re-renders

// MarkdownEditor onUpdate fires → handleUserEdit called:
const handleUserEdit = (newContent: string) => {
  contentRef.current = newContent;
  isDirtyRef.current = true;
  markDirty(tab.id, true); // Shows dot in tab
};

// Save clears dirty state:
const saveToFile = async () => {
  if (!isDirtyRef.current) return; // Skip if nothing changed
  await VaultService.writeFile(tab.filePath, contentRef.current);
  isDirtyRef.current = false;
  markDirty(tab.id, false); // Removes dot from tab
};
```

### Unmount Save

When `EditorPane` unmounts (tab switch via `key` change), the cleanup function saves:

```typescript
useEffect(() => {
  return () => {
    if (isDirtyRef.current && contentRef.current !== null) {
      VaultService.writeFile(tabPathRef.current, contentRef.current).catch(() => {});
      // Use getState() directly — component is unmounting, can't use hooks
      useWorkspaceStore.getState().markDirty(tabIdRef.current, false);
    }
  };
}, []);
```

### Close with Unsaved Changes

```typescript
// Shell.tsx — Cmd+W handler
if (tab?.isDirty) {
  confirm({
    title: 'Unsaved Changes',
    message: 'This file has unsaved changes. Discard them?',
    confirmLabel: 'Discard',
    danger: true,
  }).then((confirmed) => {
    if (confirmed) closeTab(activeTabId);
  });
}
```

---

## Git Integration

### Architecture

```
┌──────────────────┐         ┌─────────────────┐
│   GitPanel.tsx   │ ──────► │  git store       │
│   (UI)           │         │  (Zustand)       │
└──────────────────┘         └────────┬────────┘
                                      │ calls
                                      ▼
                             ┌─────────────────┐
                             │  GitService      │
                             │  (IPC wrapper)   │
                             └────────┬────────┘
                                      │ invoke()
                                      ▼
                             ┌─────────────────┐
                             │  git.rs          │
                             │  (git2 crate)    │
                             └─────────────────┘
```

### Git Operations

| Operation   | Frontend                        | Rust              | Notes                                               |
| ----------- | ------------------------------- | ----------------- | --------------------------------------------------- |
| Status      | `GitService.status()`           | `git_status`      | Lists all changed files with staged/unstaged flags  |
| Diff        | `GitService.diff(path, staged)` | `git_diff`        | Patch format diff for one file                      |
| Stage       | `GitService.stage(path)`        | `git_stage`       | `index.add_path` or `index.remove_path` for deleted |
| Unstage     | `GitService.unstage(path)`      | `git_unstage`     | `reset_default` against HEAD tree                   |
| Stage All   | `GitService.stageAll()`         | `git_stage_all`   | `index.add_all(["*"])`                              |
| Unstage All | `GitService.unstageAll()`       | `git_unstage_all` | `reset(Mixed)` to HEAD                              |
| Commit      | `GitService.commit(msg)`        | `git_commit`      | Writes tree, creates commit on HEAD                 |
| Discard     | `GitService.discard(path)`      | `git_discard`     | Checkout from HEAD (or delete if untracked)         |
| Log         | `GitService.log(limit)`         | `git_log`         | Revwalk from HEAD, max 50                           |
| Branches    | `GitService.branches()`         | `git_branches`    | Current branch + local branch list                  |

### Include Pattern Filtering

The Git panel filters changed files by the same include patterns as the file explorer. Only matching file types (e.g., `*.md`) are shown — this hides noise from generated files.

---

## Security Model

### Path Traversal Prevention

Every file command validates paths via `validate_path()`:

```rust
fn validate_path(path: &str, vault_root: &str) -> Result<(), String> {
    let root_canonical = PathBuf::from(vault_root).canonicalize()?;

    if target.exists() {
        let canonical = target.canonicalize()?;
        if !canonical.starts_with(&root_canonical) {
            return Err("Path is outside the vault");
        }
    } else {
        // For new files: validate nearest existing ancestor
        // Prevents ../../etc/passwd style attacks
    }
}
```

### Capabilities (Plugin Permissions)

```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    "core:default", // Basic IPC (invoke, listen)
    "shell:allow-open", // Open URLs in browser (not arbitrary shell commands)
    "dialog:default" // Native file/folder picker
  ]
}
```

**Not granted:** filesystem access, shell command execution, HTTP fetch. All file access goes through our validated commands.

### Content Security Policy

```json
"security": { "csp": null }
```

CSP is null (permissive) because this is a local-only app with no remote content loading. The WebView only serves local assets from Vite.

### WebView Restrictions

- `window.confirm()` / `window.prompt()` — blocked by WebView → custom UI
- `<a href>` clicks — would navigate WebView away → intercepted + opened externally
- No `eval()` or dynamic code execution needed

---

## Keyboard Shortcuts

All registered in `Shell.tsx`:

| Shortcut      | Action                                   |
| ------------- | ---------------------------------------- |
| `Cmd+P`       | Command palette (quick file open)        |
| `Cmd+N`       | Create new file                          |
| `Cmd+Shift+N` | Quick note                               |
| `Cmd+W`       | Close tab (with dirty check)             |
| `Cmd+B`       | Toggle sidebar                           |
| `Cmd+,`       | Settings                                 |
| `Cmd+Shift+F` | Search panel                             |
| `Cmd+Shift+G` | Git panel                                |
| `Cmd+J`       | Scratch pad                              |
| `Cmd+?`       | Keyboard shortcuts reference             |
| `Cmd+Shift+[` | Previous tab                             |
| `Cmd+Shift+]` | Next tab                                 |
| `Cmd+F`       | Find in file (handled in MarkdownEditor) |
| `Cmd+S`       | Save file (handled in EditorPane)        |

---

## Patterns & Conventions

### Naming

- Components: PascalCase (`EditorPane.tsx`)
- Stores: camelCase (`workspace.ts`)
- Hooks: `use` prefix (`useFileEvents.ts`)
- Services: PascalCase object (`VaultService`, `GitService`)
- Rust commands: snake_case (`read_file`, `git_status`)

### Component Patterns

```typescript
// Conditional rendering — use && pattern (not ternaries for complex cases)
{gitPanelOpen && <GitPanel />}

// Prefix unused variables with _ for ESLint
const [_unused, setUseful] = useState(false);

// No dynamic delete — use Object.fromEntries + filter
const cleaned = Object.fromEntries(
  Object.entries(obj).filter(([k]) => k !== keyToRemove)
);
```

### Custom Confirm Dialog

Never use `window.confirm` (blocked in WebView). Use the imperative API:

```typescript
import { confirm } from './ConfirmDialog';

const confirmed = await confirm({
  title: 'Delete File',
  message: 'Are you sure?',
  confirmLabel: 'Delete',
  danger: true,
});
if (confirmed) {
  /* proceed */
}
```

Implementation uses Zustand store + Promise:

- `confirm()` creates a Promise, stores the resolve function in Zustand
- `<ConfirmDialog/>` renders when `options !== null`
- Button clicks call `close(true/false)` → resolves the Promise

### Include-Pattern Filtering

**Whitelist approach** — only show files matching patterns:

```typescript
const defaultPatterns = ['*.md', '*.excalidraw', '*.mermaid'];

// FileExplorer: directories hidden if no visible descendants
function hasVisibleDescendants(entry: FileEntry, patterns: string[]): boolean {
  if (!entry.isDirectory) return matchesPattern(entry.name, patterns);
  return entry.children?.some((child) => hasVisibleDescendants(child, patterns)) ?? false;
}
```

### File Content Cache Pattern

```typescript
// Write-through cache in VaultService:
async readFile(path: string): Promise<string> {
  const content = await invoke<string>('read_file', { path });
  this._cache.set(path, content);  // Always cache on read
  return content;
}

// Synchronous read on component mount:
const cached = VaultService.getCached(tab.filePath);
const [content, setContent] = useState<string | null>(cached ?? null);
// If cached → editor renders immediately, no loading state
```

### EditorPane Key Pattern

```typescript
// EditorArea.tsx
<EditorPane key={activeTab.id} tab={activeTab} editorMode={editorMode} />
```

`key={id}` forces React to unmount/remount the component when switching tabs. This ensures:

- Clean editor state (no stale TipTap content)
- Proper ref lifecycle (isDirtyRef resets)
- Unmount cleanup fires (saves dirty content)

---

## Data Flow Diagrams

### Quick Note Creation

```
User presses Cmd+Shift+N
    │
    ▼
Shell.createQuickNote()
    ├─ Read quickNote settings (folder, nameTemplate)
    ├─ VaultService.createDir(scratchDir)  [ensure folder exists]
    ├─ Generate filename from template: note-{date}-{time}.md
    ├─ VaultService.createFile(fullPath, 'md')
    ├─ VaultService.writeFile(path, template content)
    ├─ VaultService.listFiles(vaultPath) → refresh tree
    └─ workspace.openFile(createdPath) → opens new tab
```

### Command Palette File Open

```
User presses Cmd+P → CommandPalette opens
    │
    ▼
CommandPalette renders:
    ├─ flattenTree(fileTree) → list of all non-directory files
    ├─ cmdk provides fuzzy search filtering
    └─ User selects file
        │
        ▼
    workspace.openFile(selectedPath)
        │
        ▼
    EditorPane mounts with new tab
```

### Git Commit Flow

```
User opens Git panel (Cmd+Shift+G)
    │
    ▼
GitPanel mounts → git store refresh()
    ├─ GitService.status() → lists changed files
    └─ GitService.diff(selectedFile) → shows diff
    │
    ▼
User stages files:
    ├─ Click "+" → GitService.stage(path)
    └─ Click "Stage All" → GitService.stageAll()
    │
    ▼
User types commit message + clicks Commit:
    ├─ GitService.commit(message)
    └─ git store refresh() → UI updates (files disappear from list)
```

### External File Change

```
User edits file in another app (VS Code, etc.)
    │
    ▼
notify crate detects modification
    │
    ▼
Rust emits "fs:modified" event
    │
    ▼
useFileEvents hook fires refresh callback:
    ├─ VaultService.listFiles(vaultPath)
    └─ setFileTree(mapFileEntries(tree))
    │
    ▼
FileExplorer re-renders with updated tree
(Note: open editor does NOT auto-reload — would lose unsaved edits)
```
