# Abbeyfield Scotland – Node.js Website

A simple, accessible, brand‑styled website for a charity supporting older people in Scotland.

## Features
- Node.js + Express + EJS, no front-end build step
- Public pages: Home, About, Services, Contact
- Locations: all 16 houses, filterable by region, type of care and vacancies, each with its own page (data in `data/locations.json`)
- Members‑only area behind a password, with a signed session cookie, login rate limiting and logout
- Security headers (helmet), gzip, 404 and 500 pages, `/healthz` for hosting health checks
- Accessible by default: skip link, one `<h1>` per page, labelled form fields, AA contrast in light and dark mode, reduced‑motion support
- Smoke tests using Node's built‑in test runner

## Running locally (Node.js)
Needs [Node.js](https://nodejs.org) 18 or later (22 LTS recommended). The same steps work on Windows, macOS and Linux; only the copy command differs.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your `.env` file from the example, then open it and set `MEMBER_PASSWORD`:

   | Shell | Command |
   |---|---|
   | PowerShell (Windows) | `Copy-Item .env.example .env` |
   | Command Prompt (Windows) | `copy .env.example .env` |
   | bash / zsh (macOS, Linux, Git Bash) | `cp .env.example .env` |

3. Start the site:
   ```bash
   npm run dev
   ```
   `npm run dev` restarts on file changes; `npm start` runs without watching. Open http://localhost:3000 and press Ctrl+C to stop.

Run the tests with `npm test`.

To generate a `SESSION_SECRET` (any shell):
```bash
node -p "require('crypto').randomBytes(32).toString('hex')"
```

### Windows notes
- **OneDrive:** if the project lives in a OneDrive folder, OneDrive will try to sync `node_modules` (thousands of files), which is slow and can lock files during `npm install`. Either clone the repo outside OneDrive (for example `C:\dev\abbeyfield-testsite`) or pause syncing while installing.
- **Port already in use:** if you see `EADDRINUSE`, set a different `PORT` in `.env`, or find what is using port 3000 with `netstat -ano | findstr :3000`.
- **Line endings:** `.gitattributes` normalises line endings, so files checked out on Windows still work inside the Linux container.

## Running in a container (Docker)
Needs [Docker Desktop](https://www.docker.com/products/docker-desktop/) on Windows or macOS (use the WSL 2 backend on Windows), or Docker Engine with the Compose plugin on Linux. You don't need Node.js installed to run the container.

1. Make sure Docker Desktop is running (the whale icon in the system tray says "Docker Desktop is running"). Check with:
   ```bash
   docker version
   ```
2. Create `.env` as in step 2 above. It is optional: without it the site runs but the members area is disabled.
3. Build and start the container from the project folder:
   ```bash
   docker compose up --build
   ```
   Open http://localhost:3000. Press Ctrl+C to stop.

Other useful commands:

| Task | Command |
|---|---|
| Start in the background | `docker compose up --build -d` |
| See the logs | `docker compose logs -f` |
| Check it is healthy | `docker compose ps` (STATUS shows `healthy`) |
| Stop and remove the container | `docker compose down` |
| Rebuild after changing `package.json` | `docker compose build --no-cache` |

How the container is set up:
- The image (`Dockerfile`) runs `npm start` as a non-root user, defaults to `NODE_ENV=production` and has a health check on `/healthz`. Use it as-is for hosting that runs containers.
- `compose.yaml` is for local use. It loads `.env`, maps host port `PORT` (default 3000) to the container, and sets `NODE_ENV=development` unless `.env` says otherwise. Production mode uses secure cookies, so members login only works over HTTPS.
- Code changes need a rebuild (`docker compose up --build`); for day-to-day editing, `npm run dev` is quicker.

Without Compose, the equivalent is:
```bash
docker build -t abbeyfield-site .
docker run --rm -p 3000:3000 --env-file .env -e NODE_ENV=development abbeyfield-site
```

## Environment
| Variable | Purpose |
|---|---|
| `MEMBER_PASSWORD` | Password for the members area. If unset, the members area is disabled. |
| `SESSION_SECRET` | Signs the login cookie. Required when `NODE_ENV=production`. |
| `NODE_ENV` | Set to `production` when deployed (enables secure cookies and caching). |
| `PORT` | Port to listen on (default 3000). |

## Project layout
```
app.js              Express app (exported for tests)
server.js           Starts the server
lib/locations.js    Loads and filters location data
data/locations.json Location content (see "Data to verify")
views/              EJS templates (partials/ holds header and footer)
public/             CSS and images
test/               Smoke tests
Dockerfile          Container image
compose.yaml        Local container setup (docker compose up)
```

## Data to verify before launch
`data/locations.json` was extracted from the current site on 18 October 2026. Check these with the societies:
- Room counts: Rutherglen lists 41 but the houses described add up to 38; Helensburgh lists 10 but describes 9 apartments; Monifieth lists 12 but describes ten singles and one double.
- Vacancy flags change often and are shown with an "as at" date.
- 10 of 16 locations have no description yet.

## Known gaps
- `public/images/animated_logo.gif` is an empty (0 byte) file, so the header shows text only until a real logo is added. A static logo (PNG or SVG) is recommended: an animated GIF cannot be paused, which fails WCAG 2.2.2.
- The members area is a single shared password. For individual accounts, move to a proper user store.

## Deploy
Render, Heroku or Azure App Service all work: set `NODE_ENV=production`, `SESSION_SECRET` and `MEMBER_PASSWORD`, use `npm start` as the start command, and `/healthz` as the health check path. Platforms that run containers (Azure Container Apps, Render, Fly.io) can build the `Dockerfile` directly; set the same variables there and serve over HTTPS.
