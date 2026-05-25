use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{command, AppHandle};

#[derive(Serialize)]
pub struct VaultMeta {
    pub path: String,
    pub file_count: usize,
}

#[command]
pub async fn open_vault(app: AppHandle, path: String, state: tauri::State<'_, crate::AppState>) -> Result<VaultMeta, String> {
    let vault_path = PathBuf::from(&path);
    if !vault_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let file_count = count_files(&vault_path);

    // Store vault path in state
    let mut vault = state.vault_path.lock().map_err(|e| e.to_string())?;
    *vault = Some(path.clone());

    // Start filesystem watcher
    crate::watcher::start_watcher(&app, &path)?;

    Ok(VaultMeta { path, file_count })
}

fn count_files(dir: &PathBuf) -> usize {
    let mut count = 0;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                count += count_files(&path);
            } else {
                count += 1;
            }
        }
    }
    count
}
