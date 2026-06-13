# Automator

Record browser workflows once, replay them anytime — and let an AI bot pick the
right workflow and fill its variables from a plain-language request.

Recording and playback run in a **cloud/server browser streamed live into your
web app** (Playwright + Chrome DevTools Protocol screencast). Nothing needs to be
installed on the end user's machine. AI (via OpenRouter) is used **only** to
choose a workflow and extract variables — the heavy lifting (recording/replay) is
deterministic and token-free.

## Architecture

```
┌──────────────────────────┐         ┌─────────────────────────────┐
│  Next.js app (port 3000) │         │  Worker (port 4000)         │
│  - Auth (Postgres)       │  HTTP   │  - Express + WebSocket      │
│  - Workflow CRUD API     │ ──────► │  - Playwright Chromium      │
│  - Bot API (OpenRouter)  │         │  - CDP screencast (frames)  │
│  - React UI + canvas     │ ◄─WS──► │  - Input forwarding         │
└──────────────────────────┘         │  - Step recorder + replay   │
                                      └─────────────────────────────┘
                     │
                     ▼
            Postgres (automator_* tables only)
```

- **Recording**: the worker launches Chromium, navigates to your start URL, and
  streams JPEG frames to a `<canvas>` in the browser. Your clicks/keystrokes are
  forwarded to the real page over the WebSocket; an injected recorder captures
  high-level steps (click / fill / select) with robust selectors. Keyboard
  entries and selections become **variables** you name after stopping.
- **Playback**: the worker replays the steps deterministically, substituting your
  variable values, while streaming the browser so you can watch.
- **Bot**: sends your workflow registry + request to OpenRouter, which returns the
  best workflow id and extracted variable values. You confirm, then it runs.

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- Postgres (auth + workflows), all tables prefixed `automator_`
- Playwright (Chromium) in a standalone Node worker (`ws` + `express`)
- Auth: bcrypt password hashing + JWT session cookie (`jose`)
- AI: OpenRouter (OpenAI-compatible) — used only for routing/extraction

## Setup

1. Install dependencies (web app + worker, including Chromium):

   ```bash
   npm install
   npm --prefix worker install
   ```

2. Configure `.env` (already present in this repo for local dev):

   ```
   POSTGRES_URL=postgresql://…
   OPENROUTER_API_KEY=sk-or-…
   OPENROUTER_MODEL=openai/gpt-4o-mini
   AUTH_SECRET=…                 # random 32-byte hex
   WORKER_PUBLIC_URL=http://localhost:4000
   WORKER_PORT=4000
   APP_URL=http://localhost:3000
   ```

3. Initialize the database (safe to run repeatedly; only creates `automator_*`
   tables, never touches existing ones):

   ```bash
   npm run db:init
   ```

## Run (development)

Run the web app and the streaming worker together:

```bash
npm run dev
```

- Web: http://localhost:3000
- Worker: http://localhost:4000

Then sign up, click **Record workflow**, perform your steps in the streamed
browser, stop, name your variables, and save. Play it back from the workflow
card, or ask the bot.

## Admin backend

Visit **`/admin`** and sign in with `ADMIN_PASSWORD` from your environment.
This UI manages all `automator_*` tables only:

- **Users** — create/edit/delete accounts (set a new password via the password field)
- **Workflows** — edit metadata, steps, and variables (JSON fields)
- **Runs** — inspect or clean up run history

Add `ADMIN_PASSWORD` to Vercel (and local `.env`) before using in production.

## Deployment notes

- The Next.js app deploys cleanly to **Vercel**.
- The worker needs a **persistent host** that can run Chromium and hold
  WebSocket connections. Vercel serverless functions cannot host it.

### Deploying the worker on Render

Use a **Web Service** (NOT a "Background Worker" — that type has no public URL or
open port, and the browser must reach the worker over `wss://`).

1. New → **Web Service** → connect the GitHub repo (`ajerni/automator`).
2. **Runtime: Docker**, **Root Directory: `worker`** (it contains the `Dockerfile`
   that uses the official Playwright image with Chromium + OS deps preinstalled).
3. Environment variables (must match the Vercel app where shared):
   - `AUTH_SECRET` — identical value to the Vercel app (used to verify the WS token).
   - `ADMIN_PASSWORD` — password for `/admin` database backend (Vercel only).
   - `OPENROUTER_*`, locale/UA overrides — optional, only if you want them on the worker.
   - `PORT` is injected by Render automatically; the worker reads it.
4. Deploy, then copy the service URL, e.g. `https://automator-worker.onrender.com`.
5. In the **Vercel** project set `WORKER_PUBLIC_URL` to that `https://…` URL. The
   browser converts it to `wss://…` automatically. Redeploy the Vercel app.

The same approach works on Railway / Fly.io / a small VM — any host that runs the
Docker image and exposes a public HTTPS/WSS port.

## Project layout

```
app/            Next.js routes (pages + API)
components/     React UI (dashboard, bot, record/play modals, stream canvas)
lib/            db, auth, workflows, openrouter, shared types, worker hook
worker/         Playwright streaming worker (record + replay + screencast)
scripts/        DB schema + init script
```

npm run dev
