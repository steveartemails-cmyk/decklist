# Deployment instructions for Codex

You are deploying **Decklist**, a DJ gig scheduler located at `C:\Users\HP\Desktop\new-app`.
The owner has not deployed anything yet. Follow these steps in order. Steps marked
**[HUMAN]** require the owner to act in a browser (account creation, secrets, clicking
deploy) — pause and ask them; do not attempt to bypass. Everything else you can run.

---

## 1. Architecture you're deploying

It is a **two-part app** and both parts must be hosted:

- **`server/`** — an Express REST API (Node, ESM). Stores gigs in a JSON file
  (`server/gigs.json`) and uploaded screenshots in `server/uploads/`. Calls the
  Anthropic API (`claude-opus-4-8`) to read booking screenshots/PDFs. **Holds the
  secret API key.** → deploy to **Render**.
- **`client/`** — a React + Vite single-page app. Build output is `client/dist/`.
  → deploy to **Netlify** (static).

The client finds the backend via a runtime variable `window.__DECKLIST_API__` set in
`client/public/config.js` (copied into `client/dist/config.js` at build). In local dev
it's `""` and Vite proxies `/api` + `/uploads` to `localhost:3001`. In production it
**must** be the live Render URL, or the site loads but every request fails.

CORS is already enabled on the server (`app.use(cors())`), so a Netlify origin calling
the Render API works without further config. The server already listens on
`process.env.PORT` (Render sets this).

---

## 2. Commit the latest code

The repo is already a git repo on branch `main` with one commit, but there are
**uncommitted changes** in the working tree. Commit them first:

```bash
cd "C:\Users\HP\Desktop\new-app"
git add -A
git commit -m "Roster filtering, PDF support, THB pricing, venue tax, day panel"
```

Do **not** commit secrets. `server/.env`, `server/uploads/`, `server/gigs.json`, and
`node_modules/` are already gitignored — verify `git status` shows none of them staged.

---

## 3. Push to GitHub  **[HUMAN for repo creation + auth]**

Ask the owner to create a new **empty** repo at <https://github.com/new> (no README,
no .gitignore, no license) named e.g. `decklist`, and give you the URL. Then:

```bash
git remote add origin https://github.com/<OWNER>/decklist.git
git push -u origin main
```

If `gh` CLI is installed and authenticated you may instead run
`gh repo create decklist --private --source=. --push`. The push needs the owner's
GitHub credentials (a browser auth prompt may appear) — that part is **[HUMAN]**.

---

## 4. Deploy the backend to Render  **[HUMAN — dashboard]**

There is a `render.yaml` blueprint at the repo root (web service, rootDir `server`,
build `npm install`, start `npm start`, healthCheckPath `/`, **plan `starter`** — the
paid ~$7/mo tier that does NOT sleep). The paid plan is intentional: on the free tier
the service sleeps and cold starts (30–60s), which combined with slow PDF reads causes
uploads to time out. Guide the owner:

1. Go to <https://render.com>, sign in (GitHub login is easiest).
2. **[HUMAN] Add a payment method** to the Render account (Account → Billing). A paid
   service won't start without one. (You, Codex, cannot do this — it's the owner's card.)
3. **New +** → **Blueprint** → select the `decklist` repo. Render reads `render.yaml`
   and creates the **decklist-api** service on the **Starter** plan. Confirm the paid
   plan if prompted.
   - If the service was already created on the free plan earlier, instead go to the
     service → **Settings → Instance Type → Starter** to upgrade it (or re-sync the
     blueprint after this `render.yaml` change).
4. When prompted, set the secret env var **`ANTHROPIC_API_KEY`** to the owner's key
   from <https://console.anthropic.com>. (The owner's local key is in
   `server/.env` but that file is gitignored and NOT on Render — it must be re-entered
   here. Never print or commit this key.)
5. (Optional) These env vars have sensible defaults but can be overridden in Render:
   - `ARTIST_ALIASES` = `Dave,Davoted,Dave Davoted,Nvara` (whose sets to pull off rosters)
   - `HOURLY_RATE` = `1000`
   - `RATE_CURRENCY` = `THB`
6. Deploy. Copy the resulting URL, e.g. `https://decklist-api.onrender.com`.
7. Verify it's up: opening `<render-url>/` should return `{"ok":true,"service":"decklist-api"}`.

> ✅ On the **Starter** plan the service does **not** sleep, so there are no cold starts —
> PDF/screenshot uploads respond promptly.
>
> ⚠️ Availability ≠ durability. Render's disk is still **ephemeral** (resets on every
> redeploy/restart). To make **gig data** survive, set up Supabase in §4b below — the
> code already supports it. (The uploaded source-image *files* still live on the
> ephemeral disk, so after a redeploy a saved gig persists but its thumbnail link may
> 404. That's cosmetic; add a Render persistent disk or object storage later if the
> source images must survive too.)

---

## 4b. Durable gig storage with Supabase (recommended)

`server/db.js` already supports Postgres: **if the env var `DATABASE_URL` is set, gigs
are stored in a Postgres `gigs` table** (auto-created on boot) instead of the ephemeral
JSON file. No code change needed — just provide a database.

1. **[HUMAN]** Create a free project at <https://supabase.com> (New project; choose a
   region near the owner; set a database password and save it).
2. **[HUMAN]** Get the connection string: Supabase dashboard → **Project Settings →
   Database → Connection string → "Session pooler"** (the pooler is IPv4-compatible,
   which Render needs — the plain "Direct connection" is IPv6-only and will fail from
   Render). Copy the **URI** form and substitute the database password for
   `[YOUR-PASSWORD]`. It looks like:
   `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
3. On the Render **decklist-api** service → **Environment** → add:
   - `DATABASE_URL` = the connection string from step 2 (mark it secret).
4. Trigger a redeploy (Manual Deploy → Deploy latest commit, or it redeploys on the env
   change). On boot the server runs `create table if not exists gigs (...)` automatically.
5. Verify: the Render log line should now read `(storage: Postgres)`, and gigs added in
   the app should survive a manual redeploy. You can also see rows in Supabase →
   **Table Editor → gigs**.

> Without `DATABASE_URL`, the server silently falls back to the JSON file — handy for
> local dev (`npm run dev` needs no database). The table stores each gig as a JSONB
> blob keyed by id, so no migrations are needed as gig fields change.

---

## 5. Point the frontend at the backend

Edit `client/public/config.js` — set the Render URL (this is not a secret; committing
it is fine):

```js
window.__DECKLIST_API__ = "https://decklist-api.onrender.com"; // the real Render URL
```

Then commit it:

```bash
git add client/public/config.js
git commit -m "Point frontend at production API"
git push
```

---

## 6. Build and deploy the frontend to Netlify

Build:

```bash
npm install --prefix client   # if deps aren't installed
npm run build --prefix client
```

This produces `client/dist/` (includes the updated `config.js` and a `_redirects` file
for SPA routing).

Deploy — **either**:

- **CLI** (if `netlify` CLI available; `netlify login` is **[HUMAN]**, opens a browser):
  ```bash
  npx netlify-cli deploy --prod --dir=client/dist
  ```
- **Manual [HUMAN]:** owner drags the `client/dist` folder onto
  <https://app.netlify.com/drop>.

Netlify returns the public URL — that's the link the owner sends to their client.

---

## 7. Verify end to end

1. Open the Netlify URL.
2. Open the browser devtools Network tab; confirm requests go to the Render URL
   (not the Netlify origin) and return 200.
3. Add credits permitting, upload a roster screenshot/PDF and confirm a gig is read,
   saved, and appears on the calendar; clicking a date opens the day panel.
4. If requests 404 or fail CORS: re-check `client/dist/config.js` has the exact Render
   URL (no trailing slash) and that the Render service is awake.

---

## 8. Redeploying later

- **Backend code change:** `git push` → Render auto-redeploys.
- **Frontend code change:** `npm run build --prefix client` → redeploy `client/dist`
  (same CLI/drag step). If the Render URL changed, update `client/public/config.js` first.
