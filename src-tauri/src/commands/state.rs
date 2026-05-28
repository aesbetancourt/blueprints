use serde_json::Value;
use std::collections::HashMap;
use tauri::AppHandle;
use tauri_plugin_zustand::ManagerExt;

/// Read a value from a Zustand store by key
#[tauri::command]
pub fn get_store_value(app: AppHandle, store: &str, key: &str) -> Result<Value, String> {
    app.zustand()
        .get::<Value>(store, key)
        .map_err(|e| e.to_string())
}

/// Read the entire state of a Zustand store as JSON
#[tauri::command]
pub fn get_store_state(app: AppHandle, store: &str) -> Result<Value, String> {
    app.zustand()
        .state::<HashMap<String, Value>>(store)
        .map(|s| serde_json::to_value(s).unwrap_or(Value::Null))
        .map_err(|e| e.to_string())
}

/// Set a value in a Zustand store by key
#[tauri::command]
pub fn set_store_value(app: AppHandle, store: &str, key: &str, value: Value) -> Result<(), String> {
    app.zustand()
        .set(store, key, value)
        .map_err(|e| e.to_string())
}

/// Patch multiple keys in a Zustand store
#[tauri::command]
pub fn patch_store(
    app: AppHandle,
    store: &str,
    patch: HashMap<String, Value>,
) -> Result<(), String> {
    app.zustand().patch(store, patch).map_err(|e| e.to_string())
}

/// Save a specific store to disk immediately
#[tauri::command]
pub fn save_store(app: AppHandle, store: &str) -> Result<(), String> {
    app.zustand().save(store).map_err(|e| e.to_string())
}

/// Save all stores to disk immediately
#[tauri::command]
pub fn save_all_stores(app: AppHandle) -> Result<(), String> {
    app.zustand().save_all().map_err(|e| e.to_string())
}
