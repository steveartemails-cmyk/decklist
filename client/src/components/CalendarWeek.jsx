import { occurrencesByDate, conflictingIds, ymd, startOfWeek, addDays } from "../schedule.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Seven-day column view of the week containing `cursor`.
export default function CalendarWeek({ cursor, gigs, onSelect }) {
  const byDate = occurrencesByDate(gigs);
  const conflicts = conflictingIds(gigs);
  const start = startOfWeek(cursor);
  const todayStr = ymd(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => {
        const key = ymd(day);
        const list = byDate.get(key) || [];
        return (
          <div key={key} className="rounded-lg bg-[#0c0c14] border border-[#1c1c28] min-h-[260px] p-2">
            <div className="text-xs text-[#8a8aa0] mb-2">
              {WEEKDAYS[i]}
              <span
                className={
                  "ml-1 " + (key === todayStr ? "text-indigo-400 font-semibold" : "text-[#c8c8d8]")
                }
              >
                {day.getDate()}
              </span>
            </div>
            <div className="space-y-1.5">
              {list.map((o) => (
                <WeekChip key={o.key} occ={o} conflict={conflicts.has(o.gig.id)} onSelect={onSelect} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekChip({ occ, conflict, onSelect }) {
  const g = occ.gig;
  const base = conflict
    ? "bg-rose-600/30 border-rose-500/60"
    : g.special
      ? "bg-amber-500/20 border-amber-500/50"
      : "bg-indigo-500/20 border-indigo-500/40";
  return (
    <button
      type="button"
      onClick={() => onSelect(g)}
      className={"w-full text-left rounded border px-2 py-1.5 text-xs " + base}
    >
      <div className="font-medium truncate">
        {conflict && "⚠ "}
        {g.special && "★ "}
        {g.eventName || g.venue || "Gig"}
      </div>
      <div className="opacity-75">
        {g.startTime}–{g.endTime}
        {g.venue && g.eventName ? ` · ${g.venue}` : ""}
      </div>
    </button>
  );
}
