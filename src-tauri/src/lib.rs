use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Emitter, Listener, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

static MINIMIZED: AtomicBool = AtomicBool::new(false);
const NORMAL_WIDTH: f64 = 400.0;
const NORMAL_HEIGHT: f64 = 500.0;
const MINI_SIZE: f64 = 48.0;

fn set_window_minimized(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let scale = window.scale_factor().unwrap_or(1.0);
        let phys_size = (MINI_SIZE * scale) as i32;
        let mini_size = tauri::PhysicalSize::new(phys_size, phys_size);

        let _ = window.unmaximize();
        let _ = window.set_resizable(false);
        let _ = window.set_always_on_top(true);
        let _ = window.set_skip_taskbar(true);
        let _ = window.set_size(mini_size);

        // Position at top-right of the current monitor
        if let Some(monitor) = window.current_monitor().unwrap_or(None) {
            let monitor_size = monitor.size();
            let monitor_pos = monitor.position();
            let margin_top = (20.0 * scale) as i32;
            let margin_right = (20.0 * scale) as i32;
            let x = monitor_pos.x + monitor_size.width as i32 - phys_size - margin_right;
            let y = monitor_pos.y + margin_top;
            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
        }

        MINIMIZED.store(true, Ordering::SeqCst);
        let _ = app.emit("minimize-state-changed", true);
    }
}

fn restore_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let scale = window.scale_factor().unwrap_or(1.0);
        let phys_w = (NORMAL_WIDTH * scale) as i32;
        let phys_h = (NORMAL_HEIGHT * scale) as i32;

        let _ = window.set_resizable(true);
        let _ = window.set_skip_taskbar(false);
        let _ = window.set_size(tauri::PhysicalSize::new(phys_w, phys_h));

        if let Some(monitor) = window.current_monitor().unwrap_or(None) {
            let monitor_size = monitor.size();
            let monitor_pos = monitor.position();
            let margin_bottom = (60.0 * scale) as i32;
            let margin_right = (20.0 * scale) as i32;
            let x = monitor_pos.x + monitor_size.width as i32 - phys_w - margin_right;
            let y = monitor_pos.y + monitor_size.height as i32 - phys_h - margin_bottom;
            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
        }

        let _ = window.set_focus();
        MINIMIZED.store(false, Ordering::SeqCst);
        let _ = app.emit("minimize-state-changed", false);
    }
}

fn toggle_mini(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(true);
        if !is_visible {
            let _ = window.show();
            let _ = window.set_focus();

            if MINIMIZED.load(Ordering::SeqCst) {
                restore_window(app);
            }
            return;
        }
    }

    if MINIMIZED.load(Ordering::SeqCst) {
        restore_window(app);
    } else {
        set_window_minimized(app);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(debug_assertions)]
            window.open_devtools();

            let _ = window.set_skip_taskbar(false);

            // Position window at bottom-right of screen
            if let Some(monitor) = window.current_monitor().unwrap_or(None) {
                let monitor_size = monitor.size();
                let monitor_pos = monitor.position();
                let scale = window.scale_factor().unwrap_or(1.0);

                let win_width = 400.0;
                let win_height = 500.0;

                let phys_w = (win_width * scale) as i32;
                let phys_h = (win_height * scale) as i32;

                let margin_bottom = 60.0;
                let margin_right = 20.0;

                let phys_margin_b = (margin_bottom * scale) as i32;
                let phys_margin_r = (margin_right * scale) as i32;

                let x = monitor_pos.x + monitor_size.width as i32 - phys_w - phys_margin_r;
                let y = monitor_pos.y + monitor_size.height as i32 - phys_h - phys_margin_b;

                let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
            }

            // System tray
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
                    "show_hide" => toggle_mini(app),
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
                        toggle_mini(tray.app_handle());
                    }
                })
                .build(app)?;

            // Global shortcut: Ctrl+\ to toggle mini mode
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Backslash);
            let handle = app.handle().clone();
            app.global_shortcut()
                .on_shortcut(shortcut, move |_app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_mini(&handle);
                    }
                })?;

            // Prevent close from quitting — hide to tray instead
            let window_for_event = app.get_webview_window("main").unwrap();
            let window_hide = window_for_event.clone();
            window_for_event.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_hide.hide();
                }
            });

            // Listen for minimize-window event from frontend
            let app_handle = app.handle().clone();
            app.listen("minimize-window", move |_event| {
                set_window_minimized(&app_handle);
            });

            // Listen for restore-window event from frontend
            let app_restore = app.handle().clone();
            app.listen("restore-window", move |_event| {
                restore_window(&app_restore);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
