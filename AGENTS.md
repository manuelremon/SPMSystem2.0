# Repository Guidelines

## Project Structure & Module Organization
- Backend (Flask) in `backend/`: routes, services, core config (`backend/core/config.py`), and entrypoint `wsgi.py`. Static build from `frontend/dist` is served by Flask.
- Frontend (React + Vite) in `frontend/`: pages/components under `frontend/src`, shared UI in `frontend/src/components/ui`, services in `frontend/src/services`.
- Data and assets: SQLite DBs in `data/`; logs in `logs/`; tests in `tests/`; helper scripts in `scripts/`. Env samples: root `.env.example` and `frontend/.env`.

## Build, Test, and Development Commands
- Backend dev: `.venv\Scripts\python.exe wsgi.py` (respects `FLASK_ENV`, writes logs to `logs/spm_backend.log`).
- Frontend dev: `cd frontend && npm run dev -- --host 0.0.0.0 --port 5173`.
- Backend tests: `python -m pytest tests/ -v`.
- Frontend tests: `cd frontend && npm test`.
- Frontend build: `cd frontend && npm run build` (output to `frontend/dist`).

## Coding Style & Naming Conventions
- Python: PEP8, type hints encouraged; snake_case for files/functions, PascalCase for classes. Config and secrets via `.env`.
- JS/TS: ES modules, functional components + hooks. Filenames kebab-case; components PascalCase; hooks `useX`. Prefer composition over inheritance.
- Indentation: 4 spaces (Python), 2 spaces (JS/TS). Keep imports ordered: stdlib → third-party → local.

## Testing Guidelines
- Backend: `pytest`; place tests mirroring modules in `tests/` (files `test_*.py`, functions `test_*`).
- Frontend: React Testing Library/Jest; keep tests near components or in `frontend/src/__tests__`. Cover UI states, API interactions (mock fetch/axios), and accessibility expectations.
- Target: add/maintain coverage for new routes/services and critical UI flows; include fixtures/fakes instead of hitting real DBs.

## Commit & Pull Request Guidelines
- Commit messages in Spanish with conventional prefix: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:` (e.g., `fix: corregir validacion de login`).
- PRs: short summary, checklist of key cambios, linked issues, screenshots/GIFs for UI changes, note any migrations, new env vars, or breaking changes.

## Security & Configuration Tips
- Copy `.env.example` → `.env`; set `SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`, `VITE_API_URL`. Never commit secrets or `data/*.db`.
- CORS/URLs: default frontend `http://localhost:5173`, backend `http://localhost:5000`; align when testing.
- Logs under `logs/` and build artifacts under `frontend/dist` should be ignored from commits.
