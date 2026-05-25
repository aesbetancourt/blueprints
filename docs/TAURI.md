# Tauri in Blueprints

This document explains how Tauri v2 works in this project — the mental model, how frontend talks to backend, and how to add new functionality.

## What is Tauri?

Tauri is a framework for building desktop apps with a Rust backend and a web frontend (HTML/CSS/JS). Unlike Electron, it uses the OS native WebView (WebKit on macOS, WebView2 on Windows) instead of bundling Chromium, resulting in tiny binaries (\~10MB vs \~150MB).

**Key difference from a web app:** The frontend cannot access the filesystem, spawn processes, or do anything "native" directly. All native operations go through Tauri's IPC bridge to the Rust backend.

## Architecture in This Project

```
┌─────────────────────────────────────────┐
│           macOS Window                   │
│  ┌─────────────────────────────────────┐ │
│  │  WebView (React app)               │ │
│  │                                     │ │
│  │  invoke('read_file', { path })  ────┼─┼──► Rust: read_file(path) → String
│  │                                     │ │
│  │  listen('fs:modified', callback) ◄──┼─┼──── Rust: app.emit('fs:modified', payload)
│  │                                     │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

Two communication directions:

1. **Frontend → Backend** (commands): `invoke()` calls Rust functions and awaits results
2. **Backend → Frontend** (events): Rust emits events that the frontend listens to

## Project Structure (Tauri-specific)

```
src-tauri/
├── src/
│   ├── main.rs              # Entry point (just calls lib::run())
│   ├── lib.rs               # App builder — plugins, state, menu, commands
│   ├── watcher.rs           # Filesystem watcher that emits events
│   └── commands/            # All IPC command handlers
│       ├── mod.rs           # Module declarations
│       ├── vault.rs         # Vault init (open_vault)
│       ├── files.rs         # File CRUD, search, tags
│       ├── git.rs           # Git operations via git2
│       └── system.rs        # Process stats via sysinfo
├── Cargo.toml               # Rust dependencies
├── tauri.conf.json          # App config (window, build, bundle)
├── capabilities/
│   └── default.json         # Permission grants for plugins
└── icons/                   # App icons
```

## How IPC Works

### Commands (Frontend → Backend)

**Rust side** — define a command function with the `#[command]` attribute:

```rust
// src-tauri/src/commands/files.rs
use tauri::command;

#[command]
pub async fn read_file(path: String, state: tauri::State<'_, crate::AppState>) -> Result<String, String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&path, &vault_root)?;
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
```

**Register it** in `lib.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    commands::files::read_file,
    // ... other commands
])
```

**Frontend side** — call it via `invoke()`:

```typescript
// src/services/vault.ts
import { invoke } from '@tauri-apps/api/core';

async readFile(path: string): Promise<string> {
    return invoke<string>('read_file', { path });
}
```

**Rules:**

- Command names are the Rust function name (snake_case)
- Parameters are passed as a JSON object with camelCase keys → Tauri auto-converts to snake_case
- Return `Result<T, String>` — `Ok(T)` resolves the promise, `Err(String)` rejects it
- Use `tauri::State<'_, T>` to access shared app state (no need to pass from frontend)

### Events (Backend → Frontend)

**Rust side** — emit events using `AppHandle`:

```rust
// src-tauri/src/watcher.rs
use tauri::{AppHandle, Emitter};

let _ = app_handle.emit("fs:modified", &FsEvent { path: "..." });
```

**Frontend side** — listen with `@tauri-apps/api/event`:

```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<{ path: string }>('fs:modified', (event) => {
  console.log('File changed:', event.payload.path);
});

// Call unlisten() to stop listening
```

## App State

Shared state across commands is managed via Tauri's state system:

```rust
// lib.rs
pub struct AppState {
    pub vault_path: Mutex<Option<String>>,
}

// In the builder:
.manage(AppState {
    vault_path: Mutex::new(None),
})
```

Commands access it via the `State` extractor:

```rust
#[command]
pub async fn list_files(path: String, state: tauri::State<'_, crate::AppState>) -> Result<...> {
    let vault = state.vault_path.lock().map_err(|e| e.to_string())?;
    // ...
}
```

## Plugins

Tauri v2 uses a plugin system. This project uses:

| Plugin | Crate                 | JS Package                  | Purpose                     |
| ------ | --------------------- | --------------------------- | --------------------------- |
| Shell  | `tauri-plugin-shell`  | `@tauri-apps/plugin-shell`  | Open URLs in system browser |
| Dialog | `tauri-plugin-dialog` | `@tauri-apps/plugin-dialog` | Native file/folder picker   |

Plugins are registered in `lib.rs`:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
```

And require capability grants in `capabilities/default.json`:

```json
{
  "permissions": ["core:default", "shell:allow-open", "dialog:default"]
}
```

## Capabilities (Permissions)

Tauri v2 has a security model where plugins must be explicitly granted permissions. The file `src-tauri/capabilities/default.json` defines what the app window is allowed to do:

- `core:default` — basic Tauri operations (invoke commands, listen to events)
- `shell:allow-open` — open URLs/files with the system default app
- `dialog:default` — show native file/folder dialogs

Custom commands (in `commands/`) don't need capability grants — they're always available once registered in `invoke_handler`.

## The Filesystem Watcher

When a vault is opened (`open_vault` command), Rust starts a background thread that watches the vault directory for changes using the `notify` crate:

```
open_vault() → start_watcher(app, path)
                    │
                    ▼
         Background thread with notify::Watcher
                    │
         On file event:
         ├─ Create → emit("fs:created", { path })
         ├─ Modify → emit("fs:modified", { path })
         └─ Delete → emit("fs:deleted", { path })
```

The frontend's `useFileEvents` hook listens to these events and refreshes the file tree.

## Configuration (tauri.conf.json)

Key fields:

```json
{
  "build": {
    "frontendDist": "../dist", // Built frontend assets (production)
    "devUrl": "http://localhost:5173", // Vite dev server (development)
    "beforeDevCommand": "pnpm dev", // Start Vite when running `pnpm tauri dev`
    "beforeBuildCommand": "pnpm build" // Build frontend before packaging
  },
  "app": {
    "windows": [
      {
        "title": "Blueprints",
        "width": 1200,
        "height": 800
      }
    ],
    "security": {
      "csp": null // No Content Security Policy (local-only app)
    }
  }
}
```

## Development Workflow

```bash
pnpm tauri dev    # Starts Vite + Rust compilation + opens native window
pnpm dev          # Frontend only (no Tauri — for UI work without native APIs)
pnpm tauri build  # Production build → .dmg/.app (macOS)
```

`pnpm tauri dev` does:

1. Runs `beforeDevCommand` (`pnpm dev`) → starts Vite at localhost:5173
2. Compiles Rust code (`cargo build`)
3. Opens a native window pointing at localhost:5173
4. Hot-reloads frontend changes; recompiles Rust on backend changes

## Adding a New Command

Step-by-step to add a new native capability:

### 1. Write the Rust command

```rust
// src-tauri/src/commands/files.rs (or create a new file)
#[command]
pub async fn my_new_command(arg1: String, state: tauri::State<'_, crate::AppState>) -> Result<String, String> {
    // Do native stuff here
    Ok("result".to_string())
}
```

### 2. Register it in lib.rs

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::files::my_new_command,
])
```

### 3. Add the TypeScript wrapper

```typescript
// src/services/vault.ts
async myNewCommand(arg1: string): Promise<string> {
    return invoke<string>('my_new_command', { arg1 });
}
```

### 4. Call it from a component

```typescript
const result = await VaultService.myNewCommand('hello');
```

## Adding a New Event

### 1. Emit from Rust

```rust
use tauri::Emitter;
app_handle.emit("my:event", &MyPayload { data: "..." })?;
```

### 2. Listen in the frontend

```typescript
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen<MyPayload>('my:event', (e) => {
    console.log(e.payload.data);
  });
  return () => {
    unlisten.then((f) => f());
  };
}, []);
```

## Common Gotchas

### `window.confirm` / `window.prompt` don't work

The WebView blocks native browser dialogs. Use the custom `ConfirmDialog` component or inline inputs.

### Links navigate in the WebView

`<a href="...">` clicks will navigate the WebView away from your app. Always intercept link clicks and use `open()` from `@tauri-apps/plugin-shell` to open in the system browser.

### IPC is async

Even for fast operations (reading a small local file), `invoke()` crosses the IPC bridge and takes at least one event loop tick. Use caching patterns (like `VaultService._cache`) to avoid UI flicker.

### Rust panics crash the app

Unlike JavaScript errors, a panic in Rust kills the entire process. Always use `Result<T, String>` returns and proper error handling.

### File paths are absolute

Tauri commands receive absolute filesystem paths. The frontend stores and passes full paths (e.g., `/Users/me/vault/notes/file.md`). Path validation in `files.rs` ensures they're within the vault root.

### State requires Mutex

Tauri app state is shared across async command handlers. Wrap mutable state in `Mutex` and lock briefly:

```rust
let mut vault = state.vault_path.lock().map_err(|e| e.to_string())?;
*vault = Some(new_path);
```

## Rust Dependencies

| Crate                 | Version | Purpose                                       |
| --------------------- | ------- | --------------------------------------------- |
| `tauri`               | 2       | Core framework                                |
| `tauri-plugin-shell`  | 2       | Open URLs in system browser                   |
| `tauri-plugin-dialog` | 2       | Native file/folder picker dialogs             |
| `serde`               | 1       | Serialization (JSON ↔ Rust structs)           |
| `serde_json`          | 1       | JSON parsing                                  |
| `trash`               | 5       | Move files to OS trash (not permanent delete) |
| `notify`              | 7       | Filesystem watching                           |
| `git2`                | 0.19    | Git operations (libgit2 bindings)             |
| `sysinfo`             | 0.33    | Process/system resource monitoring            |

## Frontend Tauri Packages

| Package                     | Purpose                                               |
| --------------------------- | ----------------------------------------------------- |
| `@tauri-apps/api`           | Core IPC (`invoke`, `listen`, `emit`)                 |
| `@tauri-apps/plugin-shell`  | `open()` — open URLs in system browser                |
| `@tauri-apps/plugin-dialog` | `open()`/`save()` — native file dialogs               |
| `@tauri-apps/cli`           | Dev dependency — `tauri dev` / `tauri build` commands |
