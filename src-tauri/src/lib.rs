pub mod binary;
pub mod commands;
pub mod compare;
pub mod diff;
pub mod model;
pub mod walk;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::scan_session,
            commands::open_file,
            commands::write_text,
            commands::copy_file,
            commands::read_hex,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
