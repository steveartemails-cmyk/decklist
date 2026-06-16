import { useState } from "react";
import { expandOccurrences, addMonths } from "../schedule.js";
import { RATE_CURRENCY } from "../config.js";

const monthFmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const navBtn = "rounded-md border border-[#2a2a3a] hover:border-[#3a3a4f] px-2.5 py-1 text-sm";

// Monthly earnings report: total per venue and a combined total, for the month
// running from the 1st. Counts every shift dated in the month, including the
// dates of recurring gigs.
export default function ReportPanel({ gigs, onClose }) {
  const [cursor, setCursor] = useState(new Date());
  const key = monthKey(cursor);

  const byVenue = new Map(); // venue -> { total, count }
  let grandTotal = 0;
  let grandCount = 0;
  for (const gig of gigs) {
    for (const occ of expandOccurrences(gig)) {
      if (!occ.date || !occ.date.startsWith(key)) continue;
      const fee = Number(occ.gig.fee) || 0;
      const venue = occ.gig.venue || "Unspecified";
      const cur = byVenue.get(venue) || { total: 0, count: 0 };
      cur.total += fee;
      cur.count += 1;
      byVenue.set(venue, cur);
      grandTotal += fee;
      grandCount += 1;
    }
  }
  const rows = [...byVenue.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md rounded-xl border border-[#2a2a3a] bg-[#0c0c14] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Monthly earnings 📊</h2>
          <button onClick={onClose} className="text-[#8a8aa0] hover:text-white text-xl" type="button">
            ×
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor((c) => addMonths(c, -1))} className={navBtn} type="button">
            ←
          </button>
          <div className="text-sm font-medium">{monthFmt.format(cursor)}</div>
          <button onClick={() => setCursor((c) => addMonths(c, 1))} className={navBtn} type="button">
            →
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-[#8a8aa0] text-center py-6">No shifts this month.</p>
        ) : (
          <div className="space-y-1">
            {rows.map(([venue, { total, count }]) => (
              <div
                key={venue}
                className="flex items-center justify-between rounded-md px-3 py-2 bg-[#10101a] border border-[#1c1c28]"
              >
                <div className="text-sm">
                  {venue}
                  <span className="text-[#8a8aa0] text-xs ml-2">
                    {count} shift{count > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="text-sm tabular-nums">
                  {total.toLocaleString()} {RATE_CURRENCY}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-md px-3 py-2 mt-2 bg-indigo-600/20 border border-indigo-500/40 font-semibold">
              <div className="text-sm">
                Total — all venues
                <span className="text-indigo-200/70 text-xs ml-2">
                  {grandCount} shift{grandCount > 1 ? "s" : ""}
                </span>
              </div>
              <div className="text-sm tabular-nums">
                {grandTotal.toLocaleString()} {RATE_CURRENCY}
              </div>
            </div>
          </div>
        )}

        <p className="text-[10px] text-[#8a8aa0] mt-3">
          Booked fees for shifts dated in this month (1st onward), including recurring dates.
        </p>
      </div>
    </div>
  );
}
