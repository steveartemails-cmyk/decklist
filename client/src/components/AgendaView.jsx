import { occurrencesByDate, conflictingIds, parseYMD, ymd } from "../schedule.js";

const fmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

// A flat, chronological list of upcoming gig occurrences from today onward.
export default function AgendaView({ gigs, onSelect }) {
  const byDate = occurrencesByDate(gigs);
  const conflicts = conflictingIds(gigs);
  const today = ymd(new Date());

  const dates = [...byDate.keys()].filter((d) => d >= today).sort();

  if (dates.length === 0) {
    return (
      <div className="text-center text-[#8a8aa0] py-16">
        No upcoming gigs. Drop a booking screenshot above to add one.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {dates.map((date) => (
        <div key={date}>
          <div className="text-xs uppercase tracking-wide text-[#8a8aa0] mb-2">
            {fmt.format(parseYMD(date))}
          </div>
          <div className="space-y-1.5">
            {byDate.get(date).map((o) => {
              const g = o.gig;
              const conflict = conflicts.has(g.id);
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => onSelect(g)}
                  className={
                    "w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left " +
                    (conflict
                      ? "border-rose-500/60 bg-rose-600/15"
                      : g.special
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-[#1c1c28] bg-[#0c0c14] hover:border-[#2a2a3a]")
                  }
                >
                  <div className="w-24 shrink-0 text-sm tabular-nums text-[#c8c8d8]">
                    {g.startTime}–{g.endTime}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {conflict && <span className="text-rose-300">⚠ </span>}
                      {g.special && <span className="text-amber-400">★ </span>}
                      {g.eventName || g.venue || "Gig"}
                    </div>
                    {g.venue && g.eventName && (
                      <div className="text-xs text-[#8a8aa0] truncate">{g.venue}</div>
                    )}
                  </div>
                  {g.fee && (
                    <div className={"text-xs shrink-0 " + (g.paid ? "text-emerald-400" : "text-[#8a8aa0]")}>
                      {g.fee} {g.currency}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
