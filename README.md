# Blueprints

A vault-based markdown editor and software spec system built with Tauri, React, and TipTap.

## Features

- File explorer with nested folders, drag-and-drop, context menus
- Rich markdown editor (TipTap v3) with raw mode toggle
- Slash commands (`/`) for quick block insertion
- Wiki-link suggestions (`[[`) for cross-referencing files
- Mermaid diagram rendering
- Excalidraw drawing support
- Tag system with colored badges
- Full-text and filename search with regex support
- Backlinks panel
- Git integration (status, commit, diff)
- Customizable templates for new files
- Keyboard shortcuts throughout
- Resizable scratch pad

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v9+)
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri backend)
- Tauri CLI: `cargo install tauri-cli`

## Getting Started

```bash
# Install dependencies
pnpm install

# Run in development (launches Tauri window with hot-reload)
pnpm tauri dev

# Run frontend only (browser, no Tauri APIs)
pnpm dev
```

## Scripts

| Command             | Description                           |
| ------------------- | ------------------------------------- |
| `pnpm dev`          | Start Vite dev server (frontend only) |
| `pnpm build`        | Build frontend for production         |
| `pnpm tauri dev`    | Launch Tauri app in development mode  |
| `pnpm tauri build`  | Build the distributable Tauri app     |
| `pnpm lint`         | Run ESLint                            |
| `pnpm typecheck`    | Run TypeScript type checking          |
| `pnpm knip`         | Find unused code and dependencies     |
| `pnpm format`       | Format code with Prettier             |
| `pnpm format:check` | Check code formatting                 |

## Project Structure

```
src/                  # React frontend
  components/         # UI components (Shell, Sidebar, FileExplorer, etc.)
  editors/            # Editor implementations (MarkdownEditor, Excalidraw)
    extensions/       # TipTap extensions (SlashCommands, WikiLink, Mermaid)
  hooks/              # Custom React hooks
  store/              # Zustand stores (workspace, settings, git, annotations)
  services/           # Tauri IPC service wrappers (vault, git)
  data/               # Static data (templates)
src-tauri/            # Tauri/Rust backend
  src/                # Rust source code
  icons/              # App icons
  tauri.conf.json     # Tauri configuration
```

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Editor:** TipTap v3, tiptap-markdown
- **State:** Zustand with persist middleware
- **Desktop:** Tauri v2 (Rust backend)
- **Drawing:** Excalidraw
- **Diagrams:** Mermaid
