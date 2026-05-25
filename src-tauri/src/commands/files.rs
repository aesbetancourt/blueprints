use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileEntry>>,
}

fn validate_path(path: &str, vault_root: &str) -> Result<(), String> {
    let target = PathBuf::from(path);
    let root_canonical = PathBuf::from(vault_root)
        .canonicalize()
        .map_err(|e| format!("Invalid vault root: {}", e))?;

    // For existing paths, canonicalize directly
    if target.exists() {
        let canonical = target
            .canonicalize()
            .map_err(|e| format!("Invalid path: {}", e))?;
        if !canonical.starts_with(&root_canonical) {
            return Err("Path is outside the vault".to_string());
        }
        return Ok(());
    }

    // For non-existing paths (new files), canonicalize the nearest existing ancestor
    let mut ancestor = target.as_path();
    loop {
        match ancestor.parent() {
            Some(parent) if parent.exists() => {
                let canonical_ancestor = parent
                    .canonicalize()
                    .map_err(|e| format!("Invalid path: {}", e))?;
                if !canonical_ancestor.starts_with(&root_canonical) {
                    return Err("Path is outside the vault".to_string());
                }
                return Ok(());
            }
            Some(parent) => ancestor = parent,
            None => return Err("Path is outside the vault".to_string()),
        }
    }
}

fn get_vault_root(state: &tauri::State<'_, crate::AppState>) -> Result<String, String> {
    let vault = state.vault_path.lock().map_err(|e| e.to_string())?;
    vault.clone().ok_or_else(|| "No vault opened".to_string())
}

fn build_file_tree(dir: &PathBuf) -> Vec<FileEntry> {
    let mut entries = Vec::new();
    if let Ok(read_dir) = fs::read_dir(dir) {
        for entry in read_dir.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files and directories (starting with '.')
            if name.starts_with('.') {
                continue;
            }

            let is_directory = path.is_dir();

            // Skip common non-blueprint directories
            if is_directory && matches!(name.as_str(), "node_modules" | "target" | "dist" | "build" | "__pycache__") {
                continue;
            }

            let children = if is_directory {
                Some(build_file_tree(&path))
            } else {
                None
            };
            entries.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_directory,
                children,
            });
        }
    }
    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    entries
}

#[command]
pub async fn list_files(path: String, state: tauri::State<'_, crate::AppState>) -> Result<Vec<FileEntry>, String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&path, &vault_root)?;
    let dir = PathBuf::from(&path);
    if !dir.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    Ok(build_file_tree(&dir))
}

#[command]
pub async fn read_file(path: String, state: tauri::State<'_, crate::AppState>) -> Result<String, String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&path, &vault_root)?;
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[command]
pub async fn write_file(path: String, content: String, state: tauri::State<'_, crate::AppState>) -> Result<(), String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&path, &vault_root)?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[command]
pub async fn create_file(path: String, file_type: String, state: tauri::State<'_, crate::AppState>) -> Result<String, String> {
    let vault_root = get_vault_root(&state)?;
    // Validate the new file path is within vault
    validate_path(&path, &vault_root)?;

    // Ensure parent directory exists
    if let Some(parent) = PathBuf::from(&path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    let content = match file_type.as_str() {
        "md" => String::new(),
        "excalidraw" => "{\"type\":\"excalidraw\",\"version\":2,\"source\":\"blueprints\",\"elements\":[],\"appState\":{\"viewBackgroundColor\":\"#0f1117\"}}".to_string(),
        "mermaid" => "flowchart TD\n    Start --> End".to_string(),
        "json" => "{\n  \n}".to_string(),
        _ => String::new(),
    };

    fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(path)
}

#[command]
pub async fn file_exists(path: String, state: tauri::State<'_, crate::AppState>) -> Result<bool, String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&path, &vault_root)?;
    Ok(PathBuf::from(&path).exists())
}

#[command]
pub async fn delete_file(path: String, state: tauri::State<'_, crate::AppState>) -> Result<(), String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&path, &vault_root)?;
    trash::delete(&path).map_err(|e| e.to_string())
}

#[command]
pub async fn rename_file(old_path: String, new_path: String, state: tauri::State<'_, crate::AppState>) -> Result<(), String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&old_path, &vault_root)?;
    // Validate new_path parent is within vault
    let new_parent = PathBuf::from(&new_path).parent().map(|p| p.to_string_lossy().to_string());
    if let Some(ref p) = new_parent {
        validate_path(p, &vault_root)?;
    }
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[command]
pub async fn create_dir(path: String, state: tauri::State<'_, crate::AppState>) -> Result<String, String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&path, &vault_root)?;
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create directory: {}", e))?;
    Ok(path)
}

#[command]
pub async fn archive_file(path: String, state: tauri::State<'_, crate::AppState>) -> Result<String, String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&path, &vault_root)?;

    let source = PathBuf::from(&path);
    if !source.exists() {
        return Err("File does not exist".to_string());
    }

    // Compute relative path from vault root
    let rel_path = source
        .strip_prefix(&vault_root)
        .map_err(|_| "File is outside the vault".to_string())?;

    // Build destination in _archive/ preserving subfolder structure
    let archive_dir = PathBuf::from(&vault_root).join("_archive");
    let dest = archive_dir.join(rel_path);

    // Ensure destination parent exists
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create archive dir: {}", e))?;
    }

    // If it's a markdown file, inject status: archived into frontmatter
    if path.ends_with(".md") {
        if let Ok(content) = fs::read_to_string(&source) {
            let updated = inject_archived_status(&content);
            fs::write(&source, updated).map_err(|e| format!("Failed to update frontmatter: {}", e))?;
        }
    }

    // Move the file
    fs::rename(&source, &dest).map_err(|e| format!("Failed to archive: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

fn inject_archived_status(content: &str) -> String {
    let trimmed = content.trim_start();
    if trimmed.starts_with("---") {
        // Has frontmatter — update or add status
        let after_start = &trimmed[3..];
        if let Some(end) = after_start.find("\n---") {
            let frontmatter = &after_start[..end];
            let rest = &after_start[end + 4..]; // after closing ---

            // Replace existing status line or append
            let mut lines: Vec<&str> = frontmatter.lines().collect();
            let mut found_status = false;
            for line in lines.iter_mut() {
                if line.trim().starts_with("status:") {
                    *line = "status: archived";
                    found_status = true;
                    break;
                }
            }
            if !found_status {
                lines.push("status: archived");
            }

            return format!("---\n{}\n---{}", lines.join("\n"), rest);
        }
    }

    // No frontmatter — prepend one with status
    format!("---\nstatus: archived\n---\n\n{}", content)
}

#[command]
pub async fn move_file(source: String, dest_folder: String, state: tauri::State<'_, crate::AppState>) -> Result<String, String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&source, &vault_root)?;
    validate_path(&dest_folder, &vault_root)?;

    let source_path = PathBuf::from(&source);
    if !source_path.exists() {
        return Err("Source file does not exist".to_string());
    }

    let file_name = source_path
        .file_name()
        .ok_or("Invalid file name")?
        .to_string_lossy()
        .to_string();

    let dest_dir = PathBuf::from(&dest_folder);
    fs::create_dir_all(&dest_dir).map_err(|e| format!("Failed to create destination: {}", e))?;

    let dest_path = dest_dir.join(&file_name);
    fs::rename(&source_path, &dest_path).map_err(|e| format!("Failed to move file: {}", e))?;

    Ok(dest_path.to_string_lossy().to_string())
}

/// Count files in a directory (non-recursive for inbox count)
#[command]
pub async fn count_files_in_dir(path: String, state: tauri::State<'_, crate::AppState>) -> Result<usize, String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&path, &vault_root)?;

    let dir = PathBuf::from(&path);
    if !dir.is_dir() {
        return Ok(0);
    }

    let count = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter(|e| {
            let p = e.path();
            p.is_file() && !e.file_name().to_string_lossy().starts_with('.')
        })
        .count();

    Ok(count)
}

#[derive(Serialize)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub line_number: usize,
    pub line_content: String,
}

#[command]
pub async fn search_files(query: String, state: tauri::State<'_, crate::AppState>) -> Result<Vec<SearchResult>, String> {
    let vault_root = get_vault_root(&state)?;
    let root = PathBuf::from(&vault_root);
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    fn search_dir(dir: &PathBuf, query: &str, results: &mut Vec<SearchResult>, max_results: usize) {
        if results.len() >= max_results {
            return;
        }
        if let Ok(read_dir) = fs::read_dir(dir) {
            for entry in read_dir.flatten() {
                if results.len() >= max_results {
                    return;
                }
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();

                if name.starts_with('.') {
                    continue;
                }

                if path.is_dir() {
                    if matches!(name.as_str(), "node_modules" | "target" | "dist" | "build" | "__pycache__") {
                        continue;
                    }
                    search_dir(&path, query, results, max_results);
                } else {
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                    if !matches!(ext, "md" | "mermaid" | "excalidraw") {
                        continue;
                    }
                    // Skip excalidraw JSON content search (too noisy)
                    if ext == "excalidraw" {
                        if name.to_lowercase().contains(query) {
                            results.push(SearchResult {
                                path: path.to_string_lossy().to_string(),
                                name: name.clone(),
                                line_number: 0,
                                line_content: format!("[Excalidraw drawing: {}]", name),
                            });
                        }
                        continue;
                    }
                    if let Ok(content) = fs::read_to_string(&path) {
                        for (i, line) in content.lines().enumerate() {
                            if results.len() >= max_results {
                                return;
                            }
                            if line.to_lowercase().contains(query) {
                                results.push(SearchResult {
                                    path: path.to_string_lossy().to_string(),
                                    name: name.clone(),
                                    line_number: i + 1,
                                    line_content: line.trim().to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    search_dir(&root, &query_lower, &mut results, 100);
    Ok(results)
}

#[derive(Serialize)]
pub struct FileTagInfo {
    pub path: String,
    pub tags: Vec<String>,
    pub status: Option<String>,
}

/// Scan all markdown files for frontmatter tags and status
#[command]
pub fn scan_tags(
    state: tauri::State<crate::AppState>,
) -> Result<Vec<FileTagInfo>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("No vault open")?;

    let root = PathBuf::from(&vault_path);
    let mut results: Vec<FileTagInfo> = Vec::new();

    fn walk_for_md(dir: &PathBuf, results: &mut Vec<FileTagInfo>, vault_root: &str) {
        let Ok(entries) = fs::read_dir(dir) else { return };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "node_modules" {
                continue;
            }
            if path.is_dir() {
                walk_for_md(&path, results, vault_root);
            } else if name.ends_with(".md") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Some(info) = parse_frontmatter(&content, &path, vault_root) {
                        results.push(info);
                    }
                }
            }
        }
    }

    fn parse_frontmatter(content: &str, path: &PathBuf, vault_root: &str) -> Option<FileTagInfo> {
        let trimmed = content.trim_start();
        if !trimmed.starts_with("---") {
            return None;
        }
        let after_start = &trimmed[3..];
        let end = after_start.find("\n---")?;
        let frontmatter = &after_start[..end];

        let mut tags: Vec<String> = Vec::new();
        let mut status: Option<String> = None;

        for line in frontmatter.lines() {
            let line = line.trim();
            if line.starts_with("tags:") {
                let value = line.strip_prefix("tags:")?.trim();
                // Handle [tag1, tag2] format
                if value.starts_with('[') && value.ends_with(']') {
                    let inner = &value[1..value.len() - 1];
                    for tag in inner.split(',') {
                        let t = tag.trim().trim_matches(|c| c == '"' || c == '\'');
                        if !t.is_empty() {
                            tags.push(t.to_string());
                        }
                    }
                } else if !value.is_empty() {
                    // Single value or yaml list on same line
                    tags.push(value.to_string());
                }
            } else if line.starts_with("- ") && !tags.is_empty() && status.is_none() {
                // Continued yaml list for tags
                let t = line.strip_prefix("- ")?.trim().trim_matches(|c| c == '"' || c == '\'');
                if !t.is_empty() {
                    tags.push(t.to_string());
                }
            } else if line.starts_with("status:") {
                if let Some(val) = line.strip_prefix("status:") {
                    let s = val.trim().trim_matches(|c| c == '"' || c == '\'');
                    if !s.is_empty() {
                        status = Some(s.to_string());
                    }
                }
            }
        }

        if tags.is_empty() && status.is_none() {
            return None;
        }

        let rel_path = path
            .to_string_lossy()
            .strip_prefix(vault_root)?
            .trim_start_matches('/')
            .to_string();

        Some(FileTagInfo {
            path: rel_path,
            tags,
            status,
        })
    }

    walk_for_md(&root, &mut results, &vault_path);
    Ok(results)
}
