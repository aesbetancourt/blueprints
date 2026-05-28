mod commands;
mod watcher;

use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

pub struct AppState {
    pub vault_path: Mutex<Option<String>>,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            vault_path: Mutex::new(None),
        })
        .setup(|app| {
            // Custom menu without Cmd+N to avoid intercepting our shortcut
            let quit = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;
            let close = MenuItem::with_id(app, "close", "Close Window", true, Some("CmdOrCtrl+Shift+W"))?;
            let undo = PredefinedMenuItem::undo(app, None)?;
            let redo = PredefinedMenuItem::redo(app, None)?;
            let cut = PredefinedMenuItem::cut(app, None)?;
            let copy = PredefinedMenuItem::copy(app, None)?;
            let paste = PredefinedMenuItem::paste(app, None)?;
            let select_all = PredefinedMenuItem::select_all(app, None)?;
            let minimize = PredefinedMenuItem::minimize(app, None)?;
            let fullscreen = PredefinedMenuItem::fullscreen(app, None)?;

            let app_menu = Submenu::with_items(app, "Blueprints", true, &[&quit])?;
            let file_menu = Submenu::with_items(app, "File", true, &[&close])?;
            let edit_menu = Submenu::with_items(app, "Edit", true, &[&undo, &redo, &cut, &copy, &paste, &select_all])?;
            let window_menu = Submenu::with_items(app, "Window", true, &[&minimize, &fullscreen])?;

            let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &window_menu])?;
            app.set_menu(menu)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::vault::open_vault,
            commands::files::list_files,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::create_file,
            commands::files::file_exists,
            commands::files::set_tags,
            commands::files::get_file_tags,
            commands::files::scan_backlinks,
            commands::files::create_dir,
            commands::files::archive_file,
            commands::files::move_file,
            commands::files::count_files_in_dir,
            commands::files::delete_file,
            commands::files::delete_files,
            commands::files::rename_file,
            commands::files::search_files,
            commands::files::scan_tags,
            commands::git::git_status,
            commands::git::git_diff,
            commands::git::git_stage,
            commands::git::git_unstage,
            commands::git::git_stage_all,
            commands::git::git_unstage_all,
            commands::git::git_commit,
            commands::git::git_discard,
            commands::git::git_log,
            commands::git::git_branches,
            commands::system::get_system_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
