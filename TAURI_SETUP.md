# Pianki Tauri 桌面应用设置指南

本项目已成功集成 Tauri，可以打包成跨平台桌面应用。

## 技术架构

- **前端**: React + Vite (运行在 Tauri WebView 中)
- **后端**: Node.js Express (作为 Tauri Sidecar 独立进程运行)
- **桌面框架**: Tauri 2.x

## 开发模式

### 前提条件

1. 已安装 Rust (rustc 1.77.2+)
2. 已安装 Node.js (18+)
3. 所有依赖已安装 (`npm install`)

### 启动开发服务器

开发模式下，前端和后端分别运行：

```bash
# 启动后端和前端（传统 Web 模式）
npm run dev

# 或者启动 Tauri 桌面应用开发模式
npm run tauri:dev
```

**注意**: Tauri 开发模式会自动启动前端服务器 (localhost:3000)，但**不会**启动后端 sidecar。你需要在另一个终端窗口手动启动后端：

```bash
npm run dev:backend
```

## 生产构建

### 准备后端可执行文件

在构建 Tauri 应用之前，需要先为所有目标平台打包后端：

```bash
# 打包所有平台的后端 (macOS, Windows, Linux)
npm run package:backend
```

这将在 `src-tauri/binaries/` 目录下创建以下文件：
- `pianki-backend-aarch64-apple-darwin` (macOS ARM64)
- `pianki-backend-x86_64-apple-darwin` (macOS Intel)
- `pianki-backend-x86_64-pc-windows-msvc.exe` (Windows x64)
- `pianki-backend-x86_64-unknown-linux-gnu` (Linux x64)
- `pianki-backend-aarch64-unknown-linux-gnu` (Linux ARM64)

### 构建 Tauri 应用

```bash
# 构建当前平台的安装包
npm run tauri:build
```

构建完成后，安装包位于 `src-tauri/target/release/bundle/` 目录：

- **macOS**: `.app`, `.dmg`
- **Windows**: `.msi`, `.exe`
- **Linux**: `.deb`, `.AppImage`

## 文件系统路径

应用使用 Tauri 的标准数据目录：

- **macOS**: `~/Library/Application Support/com.pianki.app/`
- **Windows**: `%APPDATA%\com.pianki.app\`
- **Linux**: `~/.config/com.pianki.app/`

数据结构：
```
com.pianki.app/
├── data/
│   └── pianki.db     # SQLite 数据库
└── uploads/          # 上传的图片文件
```

## 环境变量

后端支持以下环境变量：

- `PIANKI_DATA_DIR`: 数据目录路径（在 Tauri 应用中自动设置）
- `PORT`: 后端服务器端口（默认 3001）

## 已解决的问题

### 1. ESM 模块打包问题（已解决）

**问题**: 早期版本使用 lowdb(JSON) 存储，pkg 打包存在兼容性问题，且性能受限。

**解决方案**:
- 替换为 SQLite 数据库，使用 `better-sqlite3` 原生驱动
- 保留自动迁移脚本，首次运行可无感知更新
- 继续兼容 pkg/Tauri 打包，并提升数据可靠性

### 2. Tauri 环境 API 请求路径问题（已解决）

**问题**: 在 Tauri 打包后的应用中，前端使用相对路径 `/api` 请求后端时，实际解析为 `tauri://localhost/api`，无法连接到 Express 后端

**原因**:
- Tauri 使用自定义协议（tauri:// 或 app://）加载前端资源
- Vite proxy 配置在生产环境不生效
- 相对路径请求无法到达 http://localhost:3001 的后端

**解决方案**:
```typescript
// frontend/src/api.ts
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (window.__TAURI_IPC__ ? 'http://localhost:3001/api' : '/api')
```

### 3. 数据库初始化问题（已解决）

**问题**: 首次安装时，数据库文件不存在或损坏，导致前端报错 `e.map is not a function`

**解决方案**:
- 增强数据库初始化逻辑，自动检测和修复损坏的数据
- 添加防御性检查，确保 API 始终返回数组
- 详细的错误日志，便于问题诊断

### 4. 开发者工具无法打开（已解决）

**问题**: 生产构建中，Ctrl+Shift+I 无法打开开发者工具

**解决方案**:
```toml
# src-tauri/Cargo.toml
tauri = { version = "2.9.2", features = ["devtools"] }

# src-tauri/tauri.conf.json
{
  "app": {
    "windows": [{ "devtools": true }],
    "withGlobalTauri": true
  }
}
```

## 当前已知问题

1. **开发模式**: 需要手动启动后端服务器
2. **首次启动**: 后端 sidecar 启动需要约 5 秒，请耐心等待
3. **打包体积**: 包含 Node.js 运行时，安装包约 60-90MB

## 常用命令

```bash
# 开发
npm run dev              # Web 开发模式（前端 + 后端）
npm run tauri:dev        # Tauri 桌面开发模式（需手动启动后端）

# 构建
npm run build            # 构建前端和后端
npm run package:backend  # 打包后端为可执行文件
npm run tauri:build      # 构建 Tauri 桌面应用

# 测试
npm run dev:frontend     # 仅前端
npm run dev:backend      # 仅后端
```

## 下一步改进

- [ ] 添加应用自动更新功能
- [ ] 优化启动速度
- [ ] 将后端迁移到 Rust (减小安装包体积)
- [ ] 添加系统托盘图标
- [ ] 实现快捷键支持
