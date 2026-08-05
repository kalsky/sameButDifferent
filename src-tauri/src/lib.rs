pub mod binary;
pub mod commands;
pub mod compare;
pub mod diff;
pub mod model;
pub mod walk;

/// Build the app menu. This exists only so "About" can be intercepted and routed to the
/// in-app dialog — Tauri's default menu opens the OS panel, which knows nothing about the
/// repo link or the update check. Everything else stays on the platform defaults.
#[cfg(desktop)]
fn build_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder};

    let about = MenuItemBuilder::with_id("about", "About Same But Different").build(app)?;

    // The app submenu is the one macOS renames after the bundle; on Windows/Linux the
    // items just live under the first menu. Defaults cover the rest (hide/quit/services).
    let app_menu = SubmenuBuilder::new(app, "Same But Different")
        .item(&about)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;

    // Keep an OS-native About entry under Help too, with real metadata rather than the
    // crate-name default the screenshot showed.
    let help_menu = SubmenuBuilder::new(app, "Help")
        .about(Some(AboutMetadata {
            name: Some("Same But Different".into()),
            version: Some(app.package_info().version.to_string()),
            authors: Some(vec!["Yaniv Kalsky".into()]),
            comments: Some("A folder & file diff/merge tool.".into()),
            ..Default::default()
        }))
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &edit_menu, &window_menu, &help_menu])
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                let menu = build_menu(app.handle())?;
                app.set_menu(menu)?;
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id() == "about" {
                // The frontend owns the About dialog; just tell it to open.
                use tauri::Emitter;
                let _ = app.emit("menu:about", ());
            }
        })
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
