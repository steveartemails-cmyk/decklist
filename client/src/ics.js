// Build an .ics (iCalendar) file from gigs so they can be imported into Google
// or Apple Calendar. Recurring gigs use an RRULE; midnight-crossing sets get a
// DTEND on the following day.

function pad(n) {
  return String(n).padStart(2, "0");
}

// "2026-06-14" + "23:00" -> "20260614T230000" (local, floating time)
function toICSDateTime(date, time) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
}

// End datetime, rolling to the next day if the set crosses midnight.
function endDateTime(gig) {
  const [hh, mm] = gig.endTime.split(":").map(Number);
  const [sh, sm] = gig.startTime.split(":").map(Number);
  let [y, m, d] = gig.date.split("-").map(Number);
  if (hh * 60 + mm <= sh * 60 + sm) {
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    y = dt.getUTCFullYear();
    m = dt.getUTCMonth() + 1;
    d = dt.getUTCDate();
  }
  return `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
}

function rrule(recurrence) {
  if (!recurrence || !recurrence.freq || recurrence.freq === "none") return null;
  const freq = recurrence.freq === "weekly" ? "WEEKLY" : "MONTHLY";
  const parts = [`FREQ=${freq}`];
  if (recurrence.count) parts.push(`COUNT=${recurrence.count}`);
  else if (recurrence.until) parts.push(`UNTIL=${recurrence.until.replace(/-/g, "")}T235959`);
  return parts.join(";");
}

function escapeText(text = "") {
  return String(text).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

function eventBlock(gig) {
  if (!gig.date || !gig.startTime || !gig.endTime) return null;
  const summary = gig.eventName || gig.venue || "DJ Gig";
  const lines = [
    "BEGIN:VEVENT",
    `UID:${gig.id}@decklist`,
    `DTSTAMP:${toICSDateTime(gig.date, gig.startTime)}`,
    `DTSTART:${toICSDateTime(gig.date, gig.startTime)}`,
    `DTEND:${endDateTime(gig)}`,
    `SUMMARY:${escapeText(gig.special ? "★ " + summary : summary)}`,
  ];
  if (gig.venue) lines.push(`LOCATION:${escapeText(gig.venue)}`);
  const desc = [
    gig.notes,
    gig.fee ? `Fee: ${gig.fee} ${gig.currency} (${gig.paid ? "paid" : "unpaid"})` : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (desc) lines.push(`DESCRIPTION:${escapeText(desc)}`);
  const rule = rrule(gig.recurrence);
  if (rule) lines.push(`RRULE:${rule}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export function buildICS(gigs) {
  const events = gigs.map(eventBlock).filter(Boolean);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Decklist//DJ Gig Scheduler//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

// Trigger a download of the given gigs as a .ics file.
export function downloadICS(gigs, filename = "decklist-gigs.ics") {
  const blob = new Blob([buildICS(gigs)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
