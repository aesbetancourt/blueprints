use crate::AppState;
use git2::{DiffOptions, Repository, Signature, StatusOptions};
use serde::Serialize;
use std::path::Path;
use tauri::State;

#[derive(Serialize, Clone)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String, // "new", "modified", "deleted", "renamed", "typechange"
    pub staged: bool,
}

#[derive(Serialize)]
pub struct GitLogEntry {
    pub id: String,
    pub message: String,
    pub author: String,
    pub date: i64,
}

#[derive(Serialize)]
pub struct GitBranchInfo {
    pub current: String,
    pub branches: Vec<String>,
}

fn get_vault_path(state: &State<AppState>) -> Result<String, String> {
    state
        .vault_path
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "No vault open".to_string())
}

fn open_repo(state: &State<AppState>) -> Result<Repository, String> {
    let vault_path = get_vault_path(state)?;
    Repository::discover(&vault_path).map_err(|e| format!("Not a git repository: {}", e))
}

#[tauri::command]
pub fn git_status(state: State<AppState>) -> Result<Vec<GitFileStatus>, String> {
    let repo = open_repo(&state)?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;
    let mut files: Vec<GitFileStatus> = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let s = entry.status();

        // Index (staged) statuses
        if s.is_index_new() {
            files.push(GitFileStatus {
                path: path.clone(),
                status: "new".into(),
                staged: true,
            });
        }
        if s.is_index_modified() {
            files.push(GitFileStatus {
                path: path.clone(),
                status: "modified".into(),
                staged: true,
            });
        }
        if s.is_index_deleted() {
            files.push(GitFileStatus {
                path: path.clone(),
                status: "deleted".into(),
                staged: true,
            });
        }
        if s.is_index_renamed() {
            files.push(GitFileStatus {
                path: path.clone(),
                status: "renamed".into(),
                staged: true,
            });
        }

        // Working tree (unstaged) statuses
        if s.is_wt_new() {
            files.push(GitFileStatus {
                path: path.clone(),
                status: "new".into(),
                staged: false,
            });
        }
        if s.is_wt_modified() {
            files.push(GitFileStatus {
                path: path.clone(),
                status: "modified".into(),
                staged: false,
            });
        }
        if s.is_wt_deleted() {
            files.push(GitFileStatus {
                path: path.clone(),
                status: "deleted".into(),
                staged: false,
            });
        }
        if s.is_wt_renamed() {
            files.push(GitFileStatus {
                path: path.clone(),
                status: "renamed".into(),
                staged: false,
            });
        }
    }

    Ok(files)
}

#[tauri::command]
pub fn git_diff(state: State<AppState>, file_path: String, staged: bool) -> Result<String, String> {
    let repo = open_repo(&state)?;
    let mut opts = DiffOptions::new();
    opts.pathspec(&file_path);

    let diff = if staged {
        let head = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
        repo.diff_tree_to_index(head.as_ref(), None, Some(&mut opts))
    } else {
        repo.diff_index_to_workdir(None, Some(&mut opts))
    };

    let diff = diff.map_err(|e| e.to_string())?;
    let mut output = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let prefix = match line.origin() {
            '+' => "+",
            '-' => "-",
            ' ' => " ",
            _ => "",
        };
        output.push_str(prefix);
        output.push_str(std::str::from_utf8(line.content()).unwrap_or(""));
        true
    })
    .map_err(|e| e.to_string())?;

    Ok(output)
}

#[tauri::command]
pub fn git_stage(state: State<AppState>, file_path: String) -> Result<(), String> {
    let repo = open_repo(&state)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let vault_path = get_vault_path(&state)?;
    let full_path = Path::new(&vault_path).join(&file_path);

    if full_path.exists() {
        index
            .add_path(Path::new(&file_path))
            .map_err(|e| e.to_string())?;
    } else {
        index
            .remove_path(Path::new(&file_path))
            .map_err(|e| e.to_string())?;
    }
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage(state: State<AppState>, file_path: String) -> Result<(), String> {
    let repo = open_repo(&state)?;
    let head = repo.head().map_err(|e| e.to_string())?;
    let commit = head.peel_to_commit().map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;

    repo.reset_default(Some(tree.as_object()), [file_path.as_str()])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_stage_all(state: State<AppState>) -> Result<(), String> {
    let repo = open_repo(&state)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage_all(state: State<AppState>) -> Result<(), String> {
    let repo = open_repo(&state)?;
    let head = repo.head().map_err(|e| e.to_string())?;
    let commit = head.peel_to_commit().map_err(|e| e.to_string())?;
    repo.reset(commit.as_object(), git2::ResetType::Mixed, None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_commit(state: State<AppState>, message: String) -> Result<String, String> {
    let repo = open_repo(&state)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(oid).map_err(|e| e.to_string())?;

    let sig = repo
        .signature()
        .or_else(|_| Signature::now("Blueprints User", "user@blueprints.app"))
        .map_err(|e| e.to_string())?;

    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.iter().collect();

    let commit_oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| e.to_string())?;

    Ok(commit_oid.to_string())
}

#[tauri::command]
pub fn git_discard(state: State<AppState>, file_path: String) -> Result<(), String> {
    let repo = open_repo(&state)?;
    let vault_path = get_vault_path(&state)?;

    // Check if file is untracked
    let mut opts = StatusOptions::new();
    opts.pathspec(&file_path);
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    if let Some(entry) = statuses.iter().next() {
        if entry.status().is_wt_new() {
            // Untracked file - delete it
            let full_path = Path::new(&vault_path).join(&file_path);
            std::fs::remove_file(&full_path).map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    // Tracked file - checkout from index/HEAD
    repo.checkout_head(Some(
        git2::build::CheckoutBuilder::new().path(&file_path).force(),
    ))
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_log(state: State<AppState>, limit: Option<usize>) -> Result<Vec<GitLogEntry>, String> {
    let repo = open_repo(&state)?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(git2::Sort::TIME)
        .map_err(|e| e.to_string())?;

    let max = limit.unwrap_or(50);
    let mut entries = Vec::new();

    for (i, oid) in revwalk.enumerate() {
        if i >= max {
            break;
        }
        let oid = oid.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        entries.push(GitLogEntry {
            id: oid.to_string()[..7].to_string(),
            message: commit.message().unwrap_or("").trim().to_string(),
            author: commit.author().name().unwrap_or("Unknown").to_string(),
            date: commit.time().seconds(),
        });
    }

    Ok(entries)
}

#[tauri::command]
pub fn git_branches(state: State<AppState>) -> Result<GitBranchInfo, String> {
    let repo = open_repo(&state)?;
    let head = repo.head().map_err(|e| e.to_string())?;
    let current = head.shorthand().unwrap_or("HEAD").to_string();

    let branches = repo
        .branches(Some(git2::BranchType::Local))
        .map_err(|e| e.to_string())?;

    let branch_names: Vec<String> = branches
        .filter_map(|b| b.ok())
        .filter_map(|(b, _)| b.name().ok().flatten().map(|n| n.to_string()))
        .collect();

    Ok(GitBranchInfo {
        current,
        branches: branch_names,
    })
}
