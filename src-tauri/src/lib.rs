use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      // 总是启用日志插件（包括生产模式）
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .build(),
      )?;

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
        log::info!("启动后端服务器 sidecar...");
        log::info!("数据目录: {}", app_data_dir.display());

        let sidecar_command = app.shell()
          .sidecar("pianki-backend")
          .expect("Failed to create sidecar command")
          .env("PIANKI_DATA_DIR", app_data_dir.to_string_lossy().to_string())
          .env("PORT", "3001");

        match sidecar_command.spawn() {
          Ok((_rx, _child)) => {
            log::info!("后端 sidecar 启动成功，等待服务器就绪...");

            // 等待后端启动（增加等待时间到 5 秒）
            std::thread::sleep(std::time::Duration::from_secs(5));

            log::info!("后端服务器应该已就绪");
          }
          Err(e) => {
            log::error!("启动后端 sidecar 失败: {}", e);
            eprintln!("❌ 无法启动后端服务器: {}", e);
            eprintln!("请检查日志文件: {}/pianki-backend.log", app_data_dir.display());
          }
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
