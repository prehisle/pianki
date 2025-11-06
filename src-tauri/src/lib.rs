use std::{
    net::TcpStream,
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};
use tauri::{Manager, RunEvent, WindowEvent, Emitter};
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use tauri_plugin_opener::OpenerExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 移除桌面窗口菜单（不设置 menu）
        // 窗口关闭时兜底终止 sidecar
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => {
                    let state = window.app_handle().state::<BackendState>();
                    state.kill_child();
                }
                _ => {}
            }
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(BackendState::default())
        .setup(|app| {
            // 总是启用日志插件（包括生产模式）
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;

            // 获取应用数据目录
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");

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

                let sidecar_command = app
                    .shell()
                    .sidecar("pianki-backend")
                    .expect("Failed to create sidecar command")
                    .env(
                        "PIANKI_DATA_DIR",
                        app_data_dir.to_string_lossy().to_string(),
                    )
                    .env("PORT", "3001");

                match sidecar_command.spawn() {
                    Ok((mut rx, child)) => {
                        log::info!("后端 sidecar 启动成功，等待服务器就绪...");

                        // 保存句柄以便退出时关闭
                        {
                            let state = app.state::<BackendState>();
                            state.store_child(child);
                        }

                        // 后台记录 sidecar 输出
                        let log_handle = app.handle().clone();
                        tauri::async_runtime::spawn(async move {
                            while let Some(event) = rx.recv().await {
                                match event {
                                    CommandEvent::Stdout(line) => {
                                        log::info!("[backend] {}", String::from_utf8_lossy(&line))
                                    }
                                    CommandEvent::Stderr(line) => {
                                        log::error!("[backend] {}", String::from_utf8_lossy(&line))
                                    }
                                    CommandEvent::Terminated(status) => {
                                        log::info!("后端进程已退出: {:?}", status);
                                        let state = log_handle.state::<BackendState>();
                                        state.clear();
                                        break;
                                    }
                                    _ => {}
                                }
                            }
                        });

                        // 不阻塞窗口显示：后台等待后端就绪，仅用于日志提示
                        let handle_for_log = app.handle().clone();
                        std::thread::spawn(move || {
                            wait_for_backend_ready(Duration::from_secs(5));
                            log::info!("后端服务器应该已就绪");
                            // 如需通知前端，可在此发事件：
                            // let _ = handle_for_log.emit_all("backend-ready", ());
                        });
                    }
                    Err(e) => {
                        log::error!("启动后端 sidecar 失败: {}", e);
                        eprintln!("❌ 无法启动后端服务器: {}", e);
                        eprintln!(
                            "请检查日志文件: {}/pianki-backend.log",
                            app_data_dir.display()
                        );
                    }
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                log::info!("接收到退出事件，准备终止后端 sidecar");
                let state = app_handle.state::<BackendState>();
                state.kill_child();
            }
        });
}

#[derive(Default)]
struct BackendState {
    child: Mutex<Option<CommandChild>>,
}

impl BackendState {
    fn store_child(&self, child: CommandChild) {
        let mut guard = self.child.lock().expect("backend child mutex poisoned");
        *guard = Some(child);
    }

    fn clear(&self) {
        self.take_child();
    }

    fn kill_child(&self) {
        if let Some(child) = self.take_child() {
            if let Err(err) = child.kill() {
                log::warn!("终止后端 sidecar 进程失败: {}", err);
            } else {
                log::info!("后端 sidecar 进程已终止");
            }
        }
    }

    fn take_child(&self) -> Option<CommandChild> {
        let mut guard = self.child.lock().expect("backend child mutex poisoned");
        guard.take()
    }
}

impl Drop for BackendState {
    fn drop(&mut self) {
        self.kill_child();
    }
}

fn wait_for_backend_ready(timeout: Duration) {
    let start = Instant::now();
    let pause = Duration::from_millis(200);

    while start.elapsed() < timeout {
        if TcpStream::connect(("127.0.0.1", 3001)).is_ok() {
            log::info!("后端端口已打开，继续启动前端");
            return;
        }
        thread::sleep(pause);
    }

    log::warn!(
        "等待后端超过 {:?}，继续启动（前端可能需要更长时间才能连接）",
        timeout
    );
}
