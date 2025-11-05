# Repository Guidelines

## Project Structure & Module Organization
Pianki is managed through npm workspaces: `frontend/` houses the React + Vite UI, `backend/` contains the Express API backed by SQLite, and `src-tauri/` describes the desktop shell and sidecar binaries. Frontend screens live in `frontend/src/components`, shared types in `frontend/src/types`, and theme assets in `frontend/src/styles`. Backend route handlers sit in `backend/src/routes`, with data helpers (e.g., `database.ts`, `anki-export.ts`) alongside the entry `index.ts`. Runtime data in `backend/data` and uploads in `backend/uploads` are generated during development but excluded from git.

## Build, Test, and Development Commands
Install once from the repo root with `npm install`. Run `npm run dev` for a full-stack loop, or narrow scope with `npm run dev:frontend` and `npm run dev:backend`. `npm run build` creates production bundles, `npm start` boots the compiled backend for smoke tests, and `npm run package:backend` assembles the Node sidecar used by Tauri. Desktop workflows rely on `npm run tauri:dev` and `npm run tauri:build`. To migrate old JSON storage, run `cd backend && npm run migrate:sqlite` and verify `backend/data/pianki.db`.

## Coding Style & Naming Conventions
Strict TypeScript is enforced across packages; add explicit return types on exported functions and avoid `any`. Match the prevailing two-space indentation, single-quote strings, and trailing-comma style shown in `frontend/src/App.tsx`. Components and context providers use PascalCase filenames, hooks/utilities use camelCase, and backend files follow resource-oriented names like `cards.ts`. Keep HTTP handlers thin, returning snake_case payloads that mirror database columns, and move persistence logic into dedicated helpers.

## Testing Guidelines
Automated coverage is still growing, so accompany new features with targeted tests. Prefer Vitest for frontend units (`*.test.tsx` colocated with components) and supertest for backend integration suites under `backend/src/__tests__`. When fixtures are required, stage them in a temporary `backend/data/fixtures` directory. Document manual verification steps in PRs, covering deck CRUD, Markdown rendering, uploads, and `.apkg` export paths.

## Commit & Pull Request Guidelines
Commits follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `ci:`) with subjects under 72 characters and buildable workspaces (`npm run build`). Use English summaries; append short Chinese context only if it adds clarity. Pull requests should include an overview, linked issues, screenshots or GIFs for UI changes, and test notes describing commands run plus manual flows. Flag schema or contract changes explicitly and request reviewers from affected areas.
