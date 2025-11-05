# 仓库指南

## 项目结构与模块组织
Pianki 使用 npm workspaces 管理：`frontend/` 目录包含 React + Vite UI，`backend/` 包含基于 SQLite 的 Express API，`src-tauri/` 描述桌面应用外壳和 sidecar 二进制文件。前端页面位于 `frontend/src/components`，共享类型在 `frontend/src/types`，主题资源在 `frontend/src/styles`。后端路由处理器位于 `backend/src/routes`，数据辅助函数（如 `database.ts`、`anki-export.ts`）与入口文件 `index.ts` 并列。运行时数据存储在 `backend/data`，上传文件在 `backend/uploads`，这些文件在开发过程中生成但不提交到 git。

## 构建、测试和开发命令
在仓库根目录运行一次 `npm install` 安装依赖。运行 `npm run dev` 启动完整的全栈开发环境，或使用 `npm run dev:frontend` 和 `npm run dev:backend` 分别启动前后端。`npm run build` 创建生产版本，`npm start` 启动编译后的后端进行快速测试，`npm run package:backend` 打包 Tauri 使用的 Node sidecar。桌面应用开发使用 `npm run tauri:dev` 和 `npm run tauri:build`。要迁移旧的 JSON 存储，运行 `cd backend && npm run migrate:sqlite` 并验证 `backend/data/pianki.db`。

## 编码风格与命名约定
所有包都强制使用严格的 TypeScript；导出的函数需要显式的返回类型声明，避免使用 `any`。遵循 `frontend/src/App.tsx` 中的两空格缩进、单引号字符串和尾随逗号风格。组件和 context provider 使用 PascalCase 文件名，hooks/工具函数使用 camelCase，后端文件遵循面向资源的命名如 `cards.ts`。保持 HTTP 处理器简洁，返回与数据库列对应的 snake_case 格式数据，将持久化逻辑移至专用辅助函数中。

## 测试指南
自动化测试覆盖率仍在增长中，因此新功能应附带针对性测试。前端单元测试优先使用 Vitest（`*.test.tsx` 与组件放在一起），后端集成测试使用 supertest 并放在 `backend/src/__tests__` 目录下。需要测试夹具时，将它们放在临时的 `backend/data/fixtures` 目录中。在 PR 中记录手动验证步骤，覆盖牌组的 CRUD 操作、Markdown 渲染、文件上传和 `.apkg` 导出路径。

## 提交与 Pull Request 指南
提交遵循 Conventional Commits 规范（`feat:`、`fix:`、`refactor:`、`ci:`），主题行不超过 72 个字符，确保工作区可构建（`npm run build`）。使用英文摘要；仅在有助于理解时附加简短的中文上下文。Pull request 应包含概述、关联的 issue、UI 变更的截图或 GIF，以及描述运行的命令和手动流程的测试说明。明确标记 schema 或接口变更，并请求相关领域的审查者。
