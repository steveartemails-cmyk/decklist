# Decklist — DJ Gig Scheduler

Upload screenshots of booking offers (DMs, flyers, emails, texts). The app reads the date, venue, time, and notes with Claude's vision, drops each gig onto an in-app calendar, and **alerts you to double bookings so you don't accept a conflicting gig.**

## Features

- **Screenshot → calendar.** Drag in one or many screenshots; Claude extracts date, start/end time, venue, event name, notes, and fee. Each read is shown as an **editable confirmation card** before it's saved, with a confidence flag for anything shaky or unreadable.
- **Double-booking alerts.** Every new or edited gig is checked for time overlap (including sets that cross midnight). Conflicts are blocked from auto-saving, flagged in red across the calendar, and require an explicit *"Save anyway"* override.
- **Calendar views.** Month, week, and agenda (list) views.
- **Special events** are visually distinguished from regular club nights.
- **Recurring gigs** (weekly / monthly) and **per-gig fee tracking** (amount, currency, paid/unpaid).
- **Export to Google / Apple Calendar** via `.ics` download (all gigs or a single gig).
- Source screenshot is kept with each gig and viewable in its detail panel.

## Stack

React + Vite (client) · Express (API) · JSON file storage (no database to install) · Anthropic vision API (`claude-opus-4-8`) for extraction.

## Setup

You need Node 18+ and an Anthropic API key (https://console.anthropic.com/).

```bash
# 1. install everything (root + server + client)
npm run install:all

# 2. add your API key
cp server/.env.example server/.env
#   then edit server/.env and paste your key into ANTHROPIC_API_KEY

# 3. run both server and client together
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:3001 (the client proxies `/api` and `/uploads` to it)

Run the conflict-logic tests any time with:

```bash
npm test
```

## How it works

- **`server/scheduling.js`** holds the conflict math. Gigs are converted to absolute minute intervals on a global timeline; a set whose end time is at/before its start time is treated as crossing midnight (+24h). Overlap is a plain interval intersection. Back-to-back sets (one ends exactly as the next begins) are *not* a conflict. Recurring gigs are expanded into occurrences before checking. Fully unit-tested.
- **`server/index.js`** exposes the REST API. `POST /api/gigs` returns **409** with the conflicting gigs unless called with `?override=1`. `POST /api/parse` sends each screenshot to Claude with a strict structured-output schema and returns drafts.
- **`server/parse.js`** runs the vision extraction. It uses Claude's structured outputs (`output_config.format`) so the response is guaranteed to match the gig schema — no brittle JSON-from-prose parsing.
- **`server/db.js`** is a small JSON-file store. Swap it for a real database later without changing the routes.
- **`client/src/schedule.js`** mirrors the server's occurrence/conflict logic so the calendar can lay out recurring gigs and flag clashes in red without a round-trip.

## Notes

- The API key lives only on the server, read from `server/.env`. It is never sent to the browser.
- Uploaded screenshots are stored in `server/uploads/` and gig data in `server/gigs.json` (both gitignored).
- Storage is single-user/local by design. For multi-user or hosting, replace `db.js` with a real database and add auth.
