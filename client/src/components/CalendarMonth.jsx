import { occurrencesByDate, conflictingIds, ymd, addDays } from "../schedule.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Month grid. Each cell lists the gig occurrences on that day. Conflicting gigs
// and special events are visually distinct.
export default function CalendarMonth({ cursor, gigs, onSelect, onSelectDate }) {
  const byDate = occurrencesByDate(gigs);
  const conflicts = conflictingIds(gigs);

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  const todayStr = ymd(new Date());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div>
      <div className="grid grid-cols-7 text-xs text-[#8a8aa0] mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-[#1c1c28] rounded-lg overflow-hidden">
        {days.map((day) => {
          const key = ymd(day);
          const inMonth = day.getMonth() === cursor.getMonth();
          const list = byDate.get(key) || [];
          return (
            <div
              key={key}
              onClick={() => onSelectDate(key)}
              className={
                "min-h-[96px] p-1.5 bg-[#0c0c14] cursor-pointer hover:bg-[#101019] " +
                (inMonth ? "" : "opacity-40")
              }
            >
              <div
                className={
                  "text-xs mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full " +
                  (key === todayStr ? "bg-indigo-600 text-white font-semibold" : "text-[#8a8aa0]")
                }
              >
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {list.map((o) => (
                  <DayChip
                    key={o.key}
                    occ={o}
                    conflict={conflicts.has(o.gig.id)}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayChip({ occ, conflict, onSelect }) {
  const g = occ.gig;
  const base = conflict
    ? "bg-rose-600/30 border-rose-500/60 text-rose-100"
    : g.special
      ? "bg-amber-500/20 border-amber-500/50 text-amber-100"
      : "bg-indigo-500/20 border-indigo-500/40 text-indigo-100";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(g);
      }}
      title={`${g.eventName || g.venue || "Gig"} ${g.startTime}–${g.endTime}`}
      className={"w-full text-left truncate rounded border px-1.5 py-0.5 text-[11px] leading-tight " + base}
    >
      {conflict && "⚠ "}
      {g.special && "★ "}
      <span className="opacity-80">{g.startTime}</span> {g.eventName || g.venue || "Gig"}
    </button>
  );
}
