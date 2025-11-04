use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // 获取应用数据目录
      let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");

      // 创建数据目录
      std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

      // 创建 data 和 uploads 子目录
      let data_dir = app_data_dir.join("data");
      let uploads_dir = app_data_dir.join("uploads");
      std::fs::create_dir_all(&data_dir).ok();
      std::fs::create_dir_all(&uploads_dir).ok();

      // 只在生产模式下启动后端 sidecar
      // 开发模式下由 npm run dev 启动后端
      if !cfg!(debug_assertions) {
        let sidecar_command = app.shell()
          .sidecar("pianki-backend")
          .unwrap()
          .env("PIANKI_DATA_DIR", app_data_dir.to_string_lossy().to_string());

        let (_rx, _child) = sidecar_command
          .spawn()
          .expect("Failed to spawn pianki-backend sidecar");

        // 等待后端启动
        std::thread::sleep(std::time::Duration::from_secs(2));
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
