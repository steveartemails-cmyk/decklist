// Client-side scheduling helpers, mirroring server/scheduling.js. Used to lay
// gigs onto the calendar (expanding recurrences into occurrences) and to flag
// conflicts in red across every view.

const MINUTES_PER_DAY = 1440;

export function timeToMinutes(time) {
  const [h, m] = String(time || "0:0").split(":").map(Number);
  return h * 60 + (m || 0);
}

export function dateToEpochDay(date) {
  const [y, m, d] = String(date).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function isSchedulable(gig) {
  return Boolean(gig && gig.date && gig.startTime && gig.endTime);
}

export function crossesMidnight(gig) {
  return timeToMinutes(gig.endTime) <= timeToMinutes(gig.startTime);
}

function interval(gig) {
  const base = dateToEpochDay(gig.date) * MINUTES_PER_DAY;
  const start = base + timeToMinutes(gig.startTime);
  let end = base + timeToMinutes(gig.endTime);
  if (crossesMidnight(gig)) end += MINUTES_PER_DAY;
  return { start, end };
}

function overlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

// Normalize a recurrence frequency to one of "weekly" | "monthly" | "none".
// Tolerates casing/whitespace ("Weekly", " WEEKLY ") so a stray value can never
// be misread as a new frequency — or, worse, leave the date un-advanced and make
// a gig clone itself onto the same day over and over.
export function normalizeFreq(freq) {
  const f = String(freq || "none").toLowerCase().trim();
  return f === "weekly" || f === "monthly" ? f : "none";
}

function shiftDate(date, freq, n) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (freq === "weekly") dt.setUTCDate(dt.getUTCDate() + 7 * n);
  else if (freq === "monthly") dt.setUTCMonth(dt.getUTCMonth() + n);
  return dt.toISOString().slice(0, 10);
}

// Expand a gig into concrete dated occurrences. Each occurrence keeps a link to
// its parent gig id so clicking an occurrence opens the original.
//
// `exdates` (YYYY-MM-DD strings) are dates the series should NOT generate —
// because that occurrence was edited into its own standalone gig, or cancelled.
export function expandOccurrences(gig, { horizon = 52 } = {}) {
  const rec = gig.recurrence;
  const freq = normalizeFreq(rec && rec.freq);
  if (freq === "none") {
    return [{ gig, date: gig.date, key: gig.id }];
  }
  const skip = new Set(gig.exdates || []);
  const out = [];
  const max = rec.count && rec.count > 0 ? rec.count : horizon;
  for (let i = 0; i < max; i++) {
    const date = shiftDate(gig.date, freq, i);
    if (rec.until && date > rec.until) break;
    if (skip.has(date)) continue; // edited out or cancelled for this date only
    out.push({ gig, date, key: `${gig.id}#${i}` });
  }
  return out;
}

// Set of gig ids that double-book at least one other gig.
export function conflictingIds(gigs) {
  const occ = [];
  for (const g of gigs) {
    if (!isSchedulable(g)) continue;
    for (const o of expandOccurrences(g)) {
      occ.push({ id: g.id, iv: interval({ ...g, date: o.date }) });
    }
  }
  const bad = new Set();
  for (let i = 0; i < occ.length; i++) {
    for (let j = i + 1; j < occ.length; j++) {
      if (occ[i].id === occ[j].id) continue;
      if (overlap(occ[i].iv, occ[j].iv)) {
        bad.add(occ[i].id);
        bad.add(occ[j].id);
      }
    }
  }
  return bad;
}

// All occurrences across all gigs, grouped by YYYY-MM-DD, sorted by start time.
export function occurrencesByDate(gigs) {
  const map = new Map();
  for (const gig of gigs) {
    for (const o of expandOccurrences(gig)) {
      if (!o.date) continue;
      if (!map.has(o.date)) map.set(o.date, []);
      map.get(o.date).push(o);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => timeToMinutes(a.gig.startTime) - timeToMinutes(b.gig.startTime));
  }
  return map;
}

// --- small date utilities shared by the calendar views ---

export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function parseYMD(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfWeek(d) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay()); // Sunday-based
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function addMonths(d, n) {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + n);
  return copy;
}
