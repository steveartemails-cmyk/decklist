import { useState } from "react";
import { expandOccurrences, addMonths } from "../schedule.js";
import { RATE_CURRENCY } from "../config.js";

const monthFmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Has this shift already finished as of `now`? Used to split earned vs expected.
function endedBy(dateStr, startTime, endTime, now) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!startTime || !endTime) {
    return new Date(y, m - 1, d, 23, 59, 59) <= now; // no times → after that day
  }
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const end = new Date(y, m - 1, d, eh, em);
  if (eh * 60 + em <= sh * 60 + sm) end.setDate(end.getDate() + 1); // crosses midnight
  return end <= now;
}

// Monthly earnings report. For each venue (and overall) it shows:
//   • Earned to date — shifts that have already happened, as of right now
//   • Expected this month — every shift dated in the month, including upcoming
// Counts the dates of recurring gigs too.
export default function ReportPanel({ gigs, onClose }) {
  const [cursor, setCursor] = useState(new Date());
  const key = monthKey(cursor);
  const now = new Date();

  const byVenue = new Map(); // venue -> { earned, expected }
  let totalEarned = 0;
  let totalExpected = 0;
  for (const gig of gigs) {
    for (const occ of expandOccurrences(gig)) {
      if (!occ.date || !occ.date.startsWith(key)) continue;
      const fee = Number(occ.gig.fee) || 0;
      const venue = occ.gig.venue || "Unspecified";
      const cur = byVenue.get(venue) || { earned: 0, expected: 0 };
      cur.expected += fee;
      totalExpected += fee;
      if (endedBy(occ.date, occ.gig.startTime, occ.gig.endTime, now)) {
        cur.earned += fee;
        totalEarned += fee;
      }
      byVenue.set(venue, cur);
    }
  }
  const rows = [...byVenue.entries()].sort((a, b) => b[1].expected - a[1].expected);
  const money = (n) => `${n.toLocaleString()} ${RATE_CURRENCY}`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-[#2a2a3a] bg-[#0c0c14] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Monthly earnings 📊</h2>
          <button onClick={onClose} className="text-[#8a8aa0] hover:text-white text-xl" type="button">
            ×
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor((c) => addMonths(c, -1))} className="rounded-md border border-[#2a2a3a] hover:border-[#3a3a4f] px-2.5 py-1 text-sm" type="button">
            ←
          </button>
          <div className="text-sm font-medium">{monthFmt.format(cursor)}</div>
          <button onClick={() => setCursor((c) => addMonths(c, 1))} className="rounded-md border border-[#2a2a3a] hover:border-[#3a3a4f] px-2.5 py-1 text-sm" type="button">
            →
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-[#8a8aa0] text-center py-6">No shifts this month.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(([venue, { earned, expected }]) => (
              <div key={venue} className="rounded-md px-3 py-2 bg-[#10101a] border border-[#1c1c28]">
                <div className="text-sm font-medium mb-1">{venue}</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8a8aa0]">Earned to date</span>
                  <span className="tabular-nums text-emerald-300">{money(earned)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8a8aa0]">Expected this month</span>
                  <span className="tabular-nums">{money(expected)}</span>
                </div>
              </div>
            ))}

            <div className="rounded-md px-3 py-2 mt-2 bg-indigo-600/20 border border-indigo-500/40">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total earned to date</span>
                <span className="tabular-nums text-emerald-300">{money(totalEarned)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total expected this month</span>
                <span className="tabular-nums">{money(totalExpected)}</span>
              </div>
            </div>
          </div>
        )}

        <p className="text-[10px] text-[#8a8aa0] mt-3">
          “Earned to date” counts shifts already finished as of now; “Expected” counts every shift
          dated in this month (1st onward), including recurring dates.
        </p>
      </div>
    </div>
  );
}
