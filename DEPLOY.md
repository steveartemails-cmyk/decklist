# Deploying Decklist

Decklist is two pieces:

- **Frontend** (`client/dist`) → static, goes on **Netlify**
- **Backend** (`server/`) → a Node/Express service, goes on **Render** (free)

Deploy the backend first, then point the frontend at it.

---

## 1. Backend → Render

1. Put this project on GitHub (any repo).
2. Go to <https://render.com> → **New +** → **Blueprint** → pick the repo.
   Render reads `render.yaml` and creates the **decklist-api** service automatically.
   (Or do it manually: New + → **Web Service**, Root Directory `server`,
   Build `npm install`, Start `npm start`.)
3. When prompted, add the environment variable:
   - `ANTHROPIC_API_KEY` = your key from <https://console.anthropic.com/>
4. Deploy. You'll get a URL like `https://decklist-api.onrender.com`. **Copy it.**

> ⚠️ **Free tier caveats — read these.**
> - The service **sleeps after ~15 min idle**; the first request then takes ~30s to wake.
> - Storage is **ephemeral**: saved gigs (`gigs.json`) and uploaded screenshots
>   reset whenever the service restarts or redeploys. Fine for a demo; for
>   permanent data, add a Render **persistent disk** (paid) or swap `db.js` for a
>   hosted database.

---

## 2. Point the frontend at the backend

Edit **`client/dist/config.js`** (one line) — no rebuild needed:

```js
window.__DECKLIST_API__ = "https://decklist-api.onrender.com"; // your Render URL
```

---

## 3. Frontend → Netlify

Drag-and-drop the **`client/dist`** folder onto <https://app.netlify.com/drop>.
That's it — Netlify gives you a public URL to send to the client.

(The `_redirects` file is already in `dist/` so deep links resolve correctly.)

---

## Re-deploying later

- **Changed frontend code?** Run `npm run build` in `client/`, re-edit
  `dist/config.js` with your backend URL, re-drop `dist` on Netlify.
- **Changed backend code?** Push to GitHub — Render redeploys automatically.

## Local development (unchanged)

Leave `config.js` as `""` and run `npm run dev` from the project root — the Vite
proxy routes `/api` and `/uploads` to the local server on :3001.
