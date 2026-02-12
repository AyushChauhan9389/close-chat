use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // ── Position window at bottom-right of screen ──
            if let Some(monitor) = window.current_monitor().unwrap_or(None) {
                let monitor_size = monitor.size();
                let monitor_pos = monitor.position();
                let scale = window.scale_factor().unwrap_or(1.0);

                let win_width = 400.0;
                let win_height = 500.0;

                let phys_w = (win_width * scale) as i32;
                let phys_h = (win_height * scale) as i32;

                let x = monitor_pos.x + monitor_size.width as i32 - phys_w;
                let y = monitor_pos.y + monitor_size.height as i32 - phys_h;

                let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
            }

            // ── System tray ──
            let show_hide = MenuItemBuilder::with_id("show_hide", "Show / Hide").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_hide)
                .separator()
                .item(&quit)
                .build()?;

            let tray_icon = Image::from_path("icons/32x32.png").unwrap_or_else(|_| {
                Image::from_bytes(include_bytes!("../icons/32x32.png"))
                    .expect("failed to load embedded tray icon")
            });

            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .tooltip("Close Chat")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show_hide" => toggle_window(app),
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // ── Global shortcut: Ctrl+\ to toggle window ──
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Backslash);
            let handle = app.handle().clone();
            app.global_shortcut()
                .on_shortcut(shortcut, move |_app, _shortcut, _event| {
                    toggle_window(&handle);
                })?;

            // ── Prevent close from quitting — hide to tray instead ──
            let window_for_event = app.get_webview_window("main").unwrap();
            let window_hide = window_for_event.clone();
            window_for_event.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_hide.hide();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
