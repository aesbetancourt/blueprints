use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::Path;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct FsEvent {
    path: String,
}

pub fn start_watcher(app: &AppHandle, vault_path: &str) -> Result<(), String> {
    let app_handle = app.clone();
    let vault = vault_path.to_string();

    thread::spawn(move || {
        let (tx, rx) = mpsc::channel::<notify::Result<Event>>();

        let mut watcher = notify::recommended_watcher(tx).expect("Failed to create watcher");
        watcher
            .watch(Path::new(&vault), RecursiveMode::Recursive)
            .expect("Failed to watch path");

        // Keep watcher alive and process events
        loop {
            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(Ok(event)) => {
                    for path in &event.paths {
                        let payload = FsEvent {
                            path: path.to_string_lossy().to_string(),
                        };
                        match event.kind {
                            EventKind::Create(_) => {
                                let _ = app_handle.emit("fs:created", &payload);
                            }
                            EventKind::Modify(_) => {
                                let _ = app_handle.emit("fs:modified", &payload);
                            }
                            EventKind::Remove(_) => {
                                let _ = app_handle.emit("fs:deleted", &payload);
                            }
                            _ => {}
                        }
                    }
                }
                Ok(Err(_)) => {}
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    Ok(())
}
