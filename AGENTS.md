# AGENTS.md

## Overview

Blueprints — A vault-based markdown editor and software spec system built with Tauri v2, React 19, and TipTap v3.

## Stack

- TypeScript, pnpm, Vite
- React 19 with Zustand (persist middleware) for state
- TipTap v3 (`^3.23.6`) with `tiptap-markdown` 0.9.0
- Tailwind CSS (dark theme with surface-\*/accent/muted token classes)
- Tauri v2 (Rust backend, `@tauri-apps/api` for IPC)
- Excalidraw for drawings, Mermaid for diagrams

## Conventions

- Tailwind for all styling; use dark theme token classes (`bg-surface-1`, `text-primary`, `border-default`, etc.)
- Zustand stores with persist middleware; always add `?? []` / `?? true` fallbacks for hydration safety
- No `window.confirm` — use the custom `confirm()` API from `src/components/ConfirmDialog.tsx`
- Include-pattern approach (whitelist) for file filtering, not exclude
- Icons in sidebar use uniform `p-1 rounded` style
- Editor mode state lifted to `EditorArea`, Rich/Raw toggle in `Breadcrumbs` component
- Each TipTap Suggestion plugin needs a unique `PluginKey` to avoid ProseMirror conflicts
- Slash commands trigger only at start of line (`startOfLine: true`)
- Use `{condition && ...}` pattern for conditional rendering (not ternaries for multi-step modals)
- Prefix unused variables with `_` to satisfy ESLint
- No dynamic `delete` — use `Object.fromEntries(…filter(…))` instead

## Key Architecture

- `src/components/Shell.tsx` — top-level layout, mounts all modals
- `src/components/EditorArea.tsx` — manages editor mode state, renders Breadcrumbs + EditorPane
- `src/editors/MarkdownEditor.tsx` — TipTap instance with `immediatelyRender: true`, `shouldRerenderOnTransaction: true`
- `src/store/workspace.ts` — file tree, tabs, active file (FileEntry uses `isDirectory`)
- `src/store/settings.ts` — persisted settings, tags, include patterns
- `src/services/vault.ts` — Tauri IPC wrapper for file/folder CRUD
- `src/services/git.ts` — Tauri IPC wrapper for git operations

## Development

```bash
pnpm install
pnpm tauri dev    # Full Tauri app with hot-reload
pnpm dev          # Frontend only (no Tauri APIs)
pnpm lint         # ESLint
pnpm typecheck    # TypeScript
pnpm knip         # Unused code detection
```
