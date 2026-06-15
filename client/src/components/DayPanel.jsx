import { occurrencesByDate, conflictingIds, parseYMD } from "../schedule.js";

const fmt = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

// Slide-over panel showing every gig on a single day. Opened by clicking a date
// cell. Each gig is clickable to open its full detail.
export default function DayPanel({ date, gigs, onSelectGig, onClose }) {
  const list = occurrencesByDate(gigs).get(date) || [];
  const conflicts = conflictingIds(gigs);

  return (
    <div className="fixed inset-0 z-20 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-sm h-full overflow-y-auto bg-[#0c0c14] border-l border-[#2a2a3a] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{fmt.format(parseYMD(date))}</h2>
          <button onClick={onClose} className="text-[#8a8aa0] hover:text-white text-xl" type="button">
            ×
          </button>
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-[#8a8aa0]">No gigs on this day.</p>
        ) : (
          <div className="space-y-2">
            {list.map((o) => {
              const g = o.gig;
              const conflict = conflicts.has(g.id);
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => onSelectGig(g)}
                  className={
                    "w-full text-left rounded-lg border px-3 py-2 " +
                    (conflict
                      ? "border-rose-500/60 bg-rose-600/15"
                      : g.special
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-[#1c1c28] bg-[#10101a] hover:border-[#2a2a3a]")
                  }
                >
                  <div className="text-sm font-medium">
                    {conflict && <span className="text-rose-300">⚠ </span>}
                    {g.special && <span className="text-amber-400">★ </span>}
                    {g.eventName || g.venue || "Gig"}
                  </div>
                  <div className="text-xs text-[#8a8aa0]">
                    {g.startTime}–{g.endTime}
                    {g.venue ? ` · ${g.venue}` : ""}
                    {g.fee ? ` · ${Number(g.fee).toLocaleString()} ${g.currency}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
