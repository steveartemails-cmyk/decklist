// scheduling.js — all the conflict math for Decklist.
//
// A gig is converted to an absolute [start, end) interval measured in minutes on
// a single global timeline (minutes since the Unix epoch). A set whose end time
// is at or before its start time is treated as crossing midnight (+24h), so an
// 11pm–3am set ends on the following day. Detecting a double booking is then a
// plain interval intersection. Back-to-back sets — one ending exactly as the
// next begins — are NOT a conflict.
//
// Recurring gigs are expanded into concrete occurrences before checking, so a
// weekly residency is compared occurrence-by-occurrence against everything else.

const MINUTES_PER_DAY = 1440;

// "14:30" -> 870
export function timeToMinutes(time) {
  const [h, m] = String(time).split(":").map(Number);
  return h * 60 + (m || 0);
}

// "2026-06-14" -> integer day number since the epoch (UTC, calendar-only)
export function dateToEpochDay(date) {
  const [y, m, d] = String(date).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// Absolute [start, end) interval in minutes. end <= start means it crosses midnight.
export function gigToInterval(gig) {
  const base = dateToEpochDay(gig.date) * MINUTES_PER_DAY;
  const startMin = timeToMinutes(gig.startTime);
  const endMin = timeToMinutes(gig.endTime);
  const start = base + startMin;
  let end = base + endMin;
  if (endMin <= startMin) end += MINUTES_PER_DAY; // crosses midnight
  return { start, end };
}

// Half-open intersection: touching endpoints (back-to-back) do not overlap.
export function intervalsOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

export function gigsConflict(a, b) {
  if (!isSchedulable(a) || !isSchedulable(b)) return false;
  return intervalsOverlap(gigToInterval(a), gigToInterval(b));
}

// A gig can only be checked once it has a date and both times.
export function isSchedulable(gig) {
  return Boolean(gig && gig.date && gig.startTime && gig.endTime);
}

// Normalize a recurrence frequency to one of "weekly" | "monthly" | "none".
// Tolerates casing/whitespace so a stray value can never be misread, or leave the
// date un-advanced and make a gig clone itself onto the same day repeatedly.
export function normalizeFreq(freq) {
  const f = String(freq || "none").toLowerCase().trim();
  return f === "weekly" || f === "monthly" ? f : "none";
}

// Shift a YYYY-MM-DD date forward by n weeks or n months.
function shiftDate(date, freq, n) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (freq === "weekly") dt.setUTCDate(dt.getUTCDate() + 7 * n);
  else if (freq === "monthly") dt.setUTCMonth(dt.getUTCMonth() + n);
  return dt.toISOString().slice(0, 10);
}

// Expand a (possibly recurring) gig into concrete occurrences. Non-recurring
// gigs return a single occurrence. `recurrence` shape:
//   { freq: "weekly" | "monthly", count?: number, until?: "YYYY-MM-DD" }
// `exdates` (YYYY-MM-DD strings) are dates the series skips — an occurrence that
// was edited into its own standalone gig, or cancelled for that date only.
export function expandOccurrences(gig, { horizon = 26 } = {}) {
  const rec = gig.recurrence;
  const freq = normalizeFreq(rec && rec.freq);
  if (freq === "none") {
    return [{ ...gig, occurrenceDate: gig.date, occurrenceIndex: 0 }];
  }
  const skip = new Set(gig.exdates || []);
  const out = [];
  const max = rec.count && rec.count > 0 ? rec.count : horizon;
  for (let i = 0; i < max; i++) {
    const date = shiftDate(gig.date, freq, i);
    if (rec.until && date > rec.until) break;
    if (skip.has(date)) continue; // edited out or cancelled for this date only
    out.push({ ...gig, date, occurrenceDate: date, occurrenceIndex: i });
  }
  return out;
}

// Every gig in `existing` that double-books `gig`. The gig's own id is skipped so
// editing a gig never conflicts with itself. Returns the stored gigs (deduped),
// not their individual occurrences.
export function findConflicts(gig, existing, opts = {}) {
  if (!isSchedulable(gig)) return [];
  const mine = expandOccurrences(gig, opts);
  const hits = new Map();
  for (const other of existing) {
    if (!other || other.id === gig.id || !isSchedulable(other)) continue;
    const theirs = expandOccurrences(other, opts);
    outer: for (const a of mine) {
      for (const b of theirs) {
        if (gigsConflict(a, b)) {
          hits.set(other.id, other);
          break outer;
        }
      }
    }
  }
  return [...hits.values()];
}
