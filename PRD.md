# Decklist — DJ Gig Scheduler · Product Requirements Document

_Status: Live in production. Last updated: 2026-06-17._

---

## 1. Overview

**Decklist** is a single-user web app that helps a working DJ manage bookings end to
end: it reads booking offers and venue rosters from screenshots/PDFs using Claude's
vision, lays each set onto a calendar, warns about double bookings, tracks earnings
per venue (in Thai Baht, with venue-specific withholding tax), and generates
professional invoice PDFs to send to venues.

**Primary user:** a DJ performing under the names *Dave / Davoted / Dave Davoted /
Nvara* across venues in Koh Samui, Thailand.

**Problem solved:** bookings arrive as messy DMs, flyers, texts, and multi-act roster
PDFs. Manually transcribing them, avoiding clashes, tracking pay (net of 3%
withholding at some venues), and producing invoices is tedious and error-prone.

**Live URLs**
- App (frontend): https://stately-unicorn-c88c0a.netlify.app
- API (backend): https://decklist-api.onrender.com
- Source: https://github.com/steveartemails-cmyk/decklist

---

## 2. Tech stack & framework

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite 6, Tailwind CSS v4 |
| **PDF generation** | jsPDF + jspdf-autotable (client-side) |
| **Backend** | Node.js + Express (ES modules) |
| **AI extraction** | Anthropic API via `@anthropic-ai/sdk`, model **`claude-opus-4-8`**, structured outputs (`output_config.format` JSON schema), image + PDF document blocks |
| **File uploads** | `multer` (disk storage) |
| **Database** | PostgreSQL (Supabase) via `pg` when `DATABASE_URL` is set; JSON-file fallback (`gigs.json`) for local dev. Gigs stored as a JSONB blob keyed by id |
| **Hosting — frontend** | Netlify (static, drag/CLI deploy) |
| **Hosting — backend** | Render (Starter plan, ~$7/mo, no sleep) |
| **Source control / CI** | GitHub; backend auto-deploys on push, frontend via `netlify deploy` |

**Repository layout (monorepo)**
```
new-app/
  client/            React + Vite SPA
    src/
      App.jsx                 state container, routing, header/menu
      api.js                  REST wrapper (handles 409 conflicts, timeouts)
      config.js               backend URL, VENUES + tax, fee math, venue helpers
      schedule.js             client-side occurrence/conflict math + date utils
      ics.js                  .ics calendar export
      components/
        UploadDropzone.jsx    drag/drop screenshots & PDFs
        ConfirmationCard.jsx  editable draft review (controlled)
        GigForm.jsx           shared gig editor (typeahead venue, auto fee)
        GigDetail.jsx         view/edit/delete an existing gig
        DayPanel.jsx          a day's shifts + "Add a shift"
        NewShiftPanel.jsx     manual shift entry
        CalendarMonth/Week.jsx, AgendaView.jsx   calendar views
        ReportPanel.jsx       monthly earnings report
        InvoiceModal.jsx      invoice builder + PDF export
  server/
    index.js          Express REST API
    scheduling.js     conflict math (unit-tested)
    scheduling.test.js  14 unit tests (node:test)
    parse.js          Claude vision extraction + venue/tax/fee normalisation
    db.js             Postgres-or-JSON storage (async)
  render.yaml         Render blueprint (Starter plan)
  CODEX_DEPLOY.md     deploy runbook
  PRD.md              this document
```

**Configurable environment (server/.env)**
- `ANTHROPIC_API_KEY` — vision API key (server-side only, never sent to browser)
- `ARTIST_ALIASES` — default `Dave,Davoted,Dave Davoted,Nvara`
- `HOURLY_RATE` — default `1000`
- `RATE_CURRENCY` — default `THB`
- `DATABASE_URL` — optional Postgres/Supabase connection string (durable storage)
- `PORT` — default `3001`

**Runtime frontend config:** `client/public/config.js` sets `window.__DECKLIST_API__`
to the backend URL, editable without rebuilding.

---

## 3. Features (all shipped)

### 3.1 Screenshot / roster → calendar (AI extraction)
- Drag-drop **images or PDFs** (DMs, flyers, texts, multi-page roster PDFs).
- Claude reads each file and returns structured drafts: event name, venue, date,
  start/end time, fee, notes, confidence, plus a per-document venue.
- **Artist filtering:** on a multi-act roster, only sets for the configured artist
  names are kept; all other acts are ignored. One file can yield **multiple** sets.
- **Document-level venue:** if the roster is headed by one venue, every shift in it
  is set to that venue.
- Relative dates ("this Friday") resolved to `YYYY-MM-DD`; times normalised to 24h;
  midnight-crossing sets handled.
- Each read appears as an **editable confirmation card** with a confidence flag and
  the source file (image thumbnail or "open source PDF" link). Unmatched files show a
  dismissible "no match" card.

### 3.2 Confirmation & saving
- Every field editable before saving (controlled by the app, not the card).
- **Add to calendar** saves one shift and **leaves the rest** of the roster's shifts.
- **Add all to calendar** saves every complete shift sequentially (so conflicts among
  the roster's own shifts are caught); clashing shifts stay flagged for review.

### 3.3 Double-booking detection
- Implemented in `server/scheduling.js` (and mirrored client-side for highlighting).
- Gigs become absolute `[start, end)` minute intervals on a global timeline;
  end ≤ start ⇒ crosses midnight (+24h). Overlap = interval intersection.
- **Back-to-back sets do not conflict.** Recurring gigs expand to occurrences before
  checking.
- API returns **409 + the conflicting gigs** unless called with `?override=1`.
- Conflicts flagged **red** across all calendar views and in a banner.
- **14 unit tests** cover the math (`npm test`).

### 3.4 Calendar views
- **Month**, **Week**, **Agenda (list)** views, with navigation and a "Today" button.
- Special events (★) and conflicts (red) are visually distinct.
- **Click a date → Day panel** listing that day's shifts; click a shift for full
  detail (view/edit/delete, single-gig `.ics` export, source file).

### 3.5 Manual shift entry
- From a date's Day panel, **+ Add a shift** opens a blank form pre-set to that date.
- Venue is a **predictive typeahead**; fee auto-calculates from times and venue tax.

### 3.6 Venues, pricing & tax
- Venues: **Ark Bar, Love Beach, Other** (no tax) · **Seen, Cabanas, 79, Other 3%**
  (3% withholding).
- Venue field is a **typeahead** (type "S" → Seen); blank if undetected; selecting a
  complete venue on one roster shift **auto-applies to all shifts** from that file.
- **Rate: 1000 THB/hour**, fee auto-derived from set length (handles midnight
  crossing). For taxed venues the stored fee is the **net** (1000/hr − 3% = 970/hr).
- Recurring gigs (weekly/monthly), per-gig fee (amount/currency/paid), special-event
  flag.

### 3.7 .ics export
- Export **all** gigs or a **single** gig as an `.ics` file (Google/Apple Calendar),
  including recurrence (RRULE) and midnight-crossing end times.

### 3.8 Reporting (burger menu)
- ☰ menu → **Reporting** → monthly earnings, navigable by month (from the 1st):
  - **Per venue:** *Earned to date* (shifts already finished as of now) and
    *Expected this month* (all shifts dated in the month, incl. recurring dates).
  - **Totals:** *Total earned to date* and *Total expected this month*.
- Taxed venues show the **net** (after 3% withholding) — what the DJ actually pockets.

### 3.9 Invoicing (per venue) → PDF
- From a venue in Reporting, **🧾 Invoice** opens a builder. **Every area is editable.**
- **Your details:** name, address, email, tel, **company name, company address**, tax ID.
- **Bill to (this venue):** recipient block, remembered per venue.
- **Invoice:** **invoice number** (defaults to `DDMMYYYY`) + **invoice date**.
- **Bank details:** account name, bank name, account number, account type, branch.
- **Set as default** saves your details + bank globally and the recipient per venue
  (localStorage), so they pre-fill next time.
- **Editable line items:** each line has Description (**defaults to "DJ Performance"**),
  Date, Time, Amount; lines can be **added/removed**; total updates live.
- **Billing:** the invoice bills the **gross total** (e.g. 4,000 for a 4-hr taxed set);
  the venue withholds the 3% on their side. No tax line on the invoice. (The app's
  report still shows the net 3,880.)
- **Save as PDF:** clean, professional layout via jsPDF — name + details top-left,
  **INVOICE** top-right, attention block with Date/Invoice No, bordered shifts table
  (#, Description, Date, Time, Amount) with **Total**, and a **Bank Detail** block.
  Saves to the device for sending to the venue.

---

## 4. Data model

**Gig** (stored; arbitrary extra fields tolerated via JSONB)
```
id            string (uuid)         createdAt   ISO timestamp
eventName     string                venue       string (a known venue or "")
date          "YYYY-MM-DD"          startTime   "HH:MM"      endTime "HH:MM"
fee           string (digits, NET)  currency    "THB"
paid          boolean               special     boolean
notes         string                recurrence  { freq: "none"|"weekly"|"monthly", count?, until? }
matchedName   string (from roster)  screenshotUrl "/uploads/..."
```

**Invoice profile** (localStorage `decklist.invoice.profile`): name, address, email,
tel, companyName, companyAddress, taxId, bankAccountName, bankName, accountNumber,
accountType, bankBranch. **Recipients** (`decklist.invoice.recipients`): `{ [venue]: attention }`.

---

## 5. API (REST, JSON)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/` | Health check `{ ok: true, service }` |
| `GET` | `/api/gigs` | List all gigs |
| `POST` | `/api/gigs` | Create; **409 + conflicts** unless `?override=1` |
| `PUT` | `/api/gigs/:id` | Update; same conflict check (excludes self) |
| `DELETE` | `/api/gigs/:id` | Delete |
| `POST` | `/api/parse` | Multipart screenshots/PDFs → Claude → drafts |
| `GET` | `/uploads/*` | Stored source files |

The API key lives only on the server. CORS is open so the Netlify origin can call Render.

---

## 6. Non-functional & ops

- **Security:** API key server-side only; uploads and gig data gitignored; no auth
  (single-user/local design).
- **Availability:** Render **Starter** plan keeps the backend awake (no cold starts);
  uploads have a client-side timeout with a friendly retry message.
- **Durability:** gig data is durable when `DATABASE_URL` (Supabase) is set. Uploaded
  **source image files** still sit on Render's ephemeral disk (a saved gig persists,
  but its thumbnail link may break after a redeploy).
- **Cost (typical):** ~$7/mo Render + pay-per-use Anthropic (cents per file) +
  $0 Netlify.
- **Deploy:** `git push` → Render redeploys backend; `npm run build --prefix client` +
  `netlify deploy --prod --dir=client/dist` for frontend. See `CODEX_DEPLOY.md`.

---

## 7. Out of scope / future ideas

- Multi-user accounts and authentication.
- Durable storage for uploaded source images (object storage).
- Per-venue default rates and contacts; invoice numbering sequences.
- Payment tracking / paid-vs-unpaid reporting; CSV export.
- Editable artist aliases and venues from the UI (currently config/code).
