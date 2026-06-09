# AGENTS.md

## Cursor Cloud specific instructions

SmartAssign is a full-stack HR staffing app: **Angular 21** frontend (`frontend/`, port **4200**) + **Spring Boot 3.2** backend (`backend/`, port **8082**) + **PostgreSQL** (`affectation_db`).

### Services (see `backend/env.example`)

| Service | Port | Required |
|---------|------|----------|
| PostgreSQL | 5432 | Yes |
| Spring Boot API | 8082 | Yes |
| Angular dev server | 4200 | Yes |

Optional: SMTP mail, Anthropic API, WebSocket (`/ws` on backend).

### PostgreSQL

The repo has no `docker-compose`. PostgreSQL must be installed and running locally.

```bash
sudo pg_ctlcluster 16 main start   # if not already running
PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE affectation_db;"  # first time only
```

Default local credentials used in `backend/env.example`: user `postgres`, DB `affectation_db`.

### Backend environment

Spring Boot does **not** auto-load `backend/.env`. Export variables before starting:

```bash
cp backend/env.example backend/.env   # first time; edit secrets
set -a && source backend/.env && set +a
```

`JWT_SECRET` is required (no default). For local dev also set `MAIL_ENABLED=false`, `EMAIL_VERIFICATION_REQUIRE_DELIVERY=false`, and `BOOTSTRAP_DEMO_USERS_ENABLED=true` with demo passwords if you need smoke/e2e logins.

Start backend (from `backend/`):

```bash
chmod +x mvnw
set -a && source .env && set +a
./mvnw spring-boot:run
```

API base: `http://localhost:8082/api`.

### Frontend

```bash
cd frontend && npm start
```

Proxies `/api` → `http://localhost:8082` via `proxy.conf.json`.

### Linux / Cloud Agent notes

- Windows helper scripts (`start-backend.ps1`, `start-frontend.ps1`) are not used on Linux; start services manually as above (tmux is fine).
- `./mvnw` may need `chmod +x` after clone.
- Playwright smoke/e2e configs default to Microsoft Edge on Windows. On Linux, install Chromium and set:
  `export SMOKE_BROWSER_PATH="$HOME/.cache/ms-playwright/chromium-*/chrome-linux64/chrome"`
  (run `npx playwright install chromium` in `frontend/` first).
- Export `SMOKE_*` credentials from `backend/.env` when running `npm run smoke:routes` or `npm run e2e:routes` in `frontend/`.

### Lint / test / build

| Check | Command | Notes |
|-------|---------|-------|
| Format (Prettier) | `cd frontend && npx prettier --check "src/**/*.{ts,html,scss}"` | No npm script; many files may warn |
| Frontend build | `cd frontend && npm run build` | Succeeds |
| Frontend unit tests | `cd frontend && npx ng test --watch=false` | Currently fails on `ManagerDashboardComponent` template/spec mismatches |
| Backend tests | `cd backend && set -a && source .env && set +a && ./mvnw test` | `@WebMvcTest` slices fail to load `SecurityConfig` (missing repository beans); app runs fine |
| Smoke / E2E | `cd frontend && npm run smoke:routes` | Requires full stack + demo users; public signup step expects a removed "S'inscrire" link on the landing page |

### Demo login (after bootstrap)

- Manager: `manager@smartassign.tn` / value of `BOOTSTRAP_DEMO_MANAGER_PASSWORD` in `.env`
- Admin: `admin@smartassign.tn`
- Collaborateur: `collab@smartassign.tn`
