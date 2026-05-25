use serde::Serialize;
use sysinfo::{Pid, System};
use tauri::command;

#[derive(Serialize)]
pub struct ProcessStats {
    /// CPU usage as a percentage (0-100+)
    pub cpu_usage: f32,
    /// Memory usage in bytes
    pub memory_bytes: u64,
    /// Memory usage formatted as a human-readable string
    pub memory_display: String,
}

#[derive(Serialize)]
pub struct SystemStats {
    /// Total system memory in bytes
    pub total_memory: u64,
    /// Used system memory in bytes
    pub used_memory: u64,
    /// App process stats
    pub process: ProcessStats,
}

fn format_bytes(bytes: u64) -> String {
    if bytes >= 1_073_741_824 {
        format!("{:.1} GB", bytes as f64 / 1_073_741_824.0)
    } else if bytes >= 1_048_576 {
        format!("{:.1} MB", bytes as f64 / 1_048_576.0)
    } else if bytes >= 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{} B", bytes)
    }
}

#[command]
pub async fn get_system_stats() -> Result<SystemStats, String> {
    let mut sys = System::new();
    sys.refresh_memory();

    let pid = Pid::from_u32(std::process::id());
    sys.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[pid]), true);

    let (cpu_usage, memory_bytes) = if let Some(process) = sys.process(pid) {
        (process.cpu_usage(), process.memory())
    } else {
        (0.0, 0)
    };

    Ok(SystemStats {
        total_memory: sys.total_memory(),
        used_memory: sys.used_memory(),
        process: ProcessStats {
            cpu_usage,
            memory_bytes,
            memory_display: format_bytes(memory_bytes),
        },
    })
}
