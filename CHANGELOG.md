# 更新日志

所有重要的项目变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

## [0.1.8] - 2025-11-06

### 新增
- ✨ 粘性工具栏：卡片列表顶部的“新建/搜索/排序”在滚动时始终固定
- ✨ 自定义顺序：为卡片增加 `sort_key`，支持在某张卡片“前/后”插入；默认按自定义顺序显示
- ✨ 列表快捷操作：卡片菜单新增“在前面插入/在后面插入”；可选显示卡片 ID，并支持复制
- ✨ 列表搜索：工具栏新增本地搜索框（正面/反面/ID），显示“命中/总数”计数
- ✨ 桌面端端口自动选择：后端端口从 `9908` 起，冲突时在 `9908–9928` 之间递增，Tauri 通过事件将实际端口通知前端

### 修复
- 🐛 桌面版导出 `.apkg` 不弹保存框：改为使用 `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs` 选择路径并写入文件
- 🐛 桌面“反馈与支持/关于”链接在部分环境无响应：统一使用 opener 插件或浏览器 `window.open`
- 🧹 移除桌面窗口菜单，避免多余入口

### 维护
- 🔧 SQLite 模式迁移：v1 → v2，新增 `sort_key` 并按创建时间初始化为稀疏序列（1000 递增）
- 🔧 前端/壳层：引入 `@tauri-apps/plugin-opener`、`@tauri-apps/plugin-dialog`、`@tauri-apps/plugin-fs`；Rust 端固定兼容版本

## [0.1.7] - 2025-11-06

### 修复
- 🐛 Windows 安装升级时后端进程占用导致无法继续：
  - 后端 sidecar 监听信号与父进程存活，父进程退出后自动结束
  - 关闭窗口/销毁时在 Tauri 侧兜底终止 sidecar
- 🐛 Markdown 单行换行未显示：
  - 前端预览启用 `remark-breaks`
  - Anki 导出使用 `marked` 的 `breaks: true`

### 新增
- ✨ 顶栏 Help 菜单：Feedback、Report a bug、Discussions、About

### 维护
- 🔧 锁文件同步，移除子包多余 lock，保证 `npm ci` 稳定

## [0.1.5] - 2025-11-06

### 修复
- 🐛 导出的 Anki 卡片在 PC 端默认“居中”显示：
  - 在导出包内注入样式 `.card { text-align: left; }`
  - 位置：`backend/src/anki-export.ts`
  - 新导出的 .apkg 在 Anki 中显示为左对齐，更适合阅读长文本

## [0.1.3] - 2025-11-04

### 修复
- 🐛 **彻底解决后端打包问题**
  - 移除 lowdb 依赖（ESM 模块导致 pkg 打包失败）
  - 实现自定义 `JsonDatabase` 类，使用 Node.js 原生 `fs/promises` API
  - 零额外依赖，完美兼容 pkg 打包工具

- 🐛 **修复 Tauri 环境 API 请求问题**
  - 检测 Tauri 环境，自动切换到绝对 URL (`http://localhost:3001/api`)
  - 解决打包后前端无法连接后端的问题
  - 开发环境继续使用 Vite proxy

- 🐛 **增强数据库初始化**
  - 自动检测和修复损坏的数据库文件
  - 添加完整性检查，确保所有字段为正确类型
  - 详细的初始化日志，便于问题诊断

- 🐛 **API 防御性检查**
  - 确保 GET `/api/decks` 和 GET `/api/cards` 始终返回数组
  - 防止 `e.map is not a function` 错误

### 新增
- ✨ 启用生产环境开发者工具
  - 添加 Cargo.toml `devtools` feature flag
  - 可以在打包后的应用中按 Ctrl+Shift+I 打开开发者工具

- ✨ 后端日志文件
  - 生产环境下后端输出到日志文件
  - 位置：`%APPDATA%\com.pianki.app\pianki-backend.log` (Windows)

### 优化
- ⚡ CI/CD 优化
  - 暂时只构建 Windows 版本（加快构建速度）
  - 其他平台可按需启用

### 技术债务清理
- 🔧 移除 `backend/package.json` 中的 lowdb 相关 pkg assets 配置
- 🔧 简化数据库实现，减少依赖复杂度

## [0.1.2] - 2025-11-04

### 新增
- ✨ 后端日志文件支持
- ✨ 前端连接状态检测组件
- ✨ 详细的错误提示和日志位置说明

### 修复
- 🐛 增加后端启动等待时间（2秒 → 5秒）
- 🐛 改进错误处理和用户提示

## [0.1.1] - 2025-11-04

### 修复
- 🐛 修复 TypeScript 编译错误
- 🐛 修复 Windows pkg 打包失败问题（使用 GZip 代替 Brotli 压缩）
- 🐛 修复 GitHub Actions 权限错误
- 🐛 修复 Tauri 二进制路径匹配问题
- 🐛 修复 macOS 交叉编译架构不匹配问题

## [0.1.0] - 2025-11-04

### 新增
- ✨ **Tauri 桌面应用支持**
  - 集成 Tauri 2.x 框架
  - 使用 Sidecar 模式运�� Node.js 后端
  - 支持 Windows、macOS、Linux 三大平台

- ✨ **GitHub Actions CI/CD**
  - 自动构建多平台安装包
  - 自动创建 GitHub Release
  - 支持 tag 触发构建

- ✨ **pkg 后端打包**
  - 使用 @yao-pkg/pkg 打包 Node.js 后端为可执行文件
  - 跨平台支持（macOS ARM64/x64, Windows x64, Linux x64/ARM64）

### 变更
- 🔧 调整数据目录为平台特定路径
  - macOS: `~/Library/Application Support/com.pianki.app/`
  - Windows: `%APPDATA%\com.pianki.app\`
  - Linux: `~/.config/com.pianki.app/`

- 🔧 后端通过环境变量 `PIANKI_DATA_DIR` 配置数据目录

## 早期版本

早期版本为纯 Web 应用，未使用版本号标记。主要功能包括：

- Markdown 编辑器（实时预览）
- 图片上传和管理
- 多牌组支持
- Anki .apkg 导出
- React + TypeScript 前端
- Node.js + Express 后端
- LowDB JSON 数据库

---

## 版本说明

- **主版本号** (Major): 不兼容的 API 变更
- **次版本号** (Minor): 向后兼容的功能新增
- **修订号** (Patch): 向后兼容的问题修复

当前处于 0.x 版本，API 可能随时变化。
