import { feeForDuration, durationHours, taxForVenue, canonicalVenue, RATE_CURRENCY, VENUES } from "../config.js";

// A controlled editor for a gig's fields. Reused by the confirmation cards (when
// reviewing a screenshot read) and by the edit panel.
const field = "w-full rounded-md bg-[#15151f] border border-[#2a2a3a] px-3 py-2 text-sm " +
  "focus:outline-none focus:border-indigo-500 placeholder:text-[#555]";
const label = "block text-xs font-medium text-[#9a9ab0] mb-1";

export default function GigForm({ value, onChange, hideRecurrence = false }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const setRec = (patch) =>
    onChange({ ...value, recurrence: { ...(value.recurrence || { freq: "none" }), ...patch } });
  const rec = value.recurrence || { freq: "none" };

  // Changing a time OR the venue re-derives the fee (venue tax matters).
  const reprice = (patch) => {
    const next = { ...value, ...patch };
    const fee = feeForDuration(next.startTime, next.endTime, next.venue);
    onChange({ ...next, fee: fee || next.fee || "", currency: value.currency || RATE_CURRENCY });
  };

  // Snap a typed venue to the proper-cased known name once it fully matches.
  const setVenue = (raw) => reprice({ venue: canonicalVenue(raw) || raw });

  const hours = durationHours(value.startTime, value.endTime);
  const tax = taxForVenue(value.venue);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className={label}>Event name</label>
        <input
          className={field}
          value={value.eventName || ""}
          onChange={(e) => set({ eventName: e.target.value })}
          placeholder="Warehouse Sessions"
        />
      </div>
      <div className="col-span-2">
        <label className={label}>Venue</label>
        <input
          list="decklist-venues"
          className={field}
          value={value.venue || ""}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="Type to search… (e.g. Seen) — leave blank if unknown"
          autoComplete="off"
        />
        <datalist id="decklist-venues">
          {VENUES.map((v) => (
            <option key={v.name} value={v.name}>
              {v.tax ? `−${v.tax * 100}% tax` : "no tax"}
            </option>
          ))}
        </datalist>
      </div>
      <div>
        <label className={label}>Date</label>
        <input
          type="date"
          className={field}
          value={value.date || ""}
          onChange={(e) => set({ date: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Start</label>
          <input
            type="time"
            className={field}
            value={value.startTime || ""}
            onChange={(e) => reprice({ startTime: e.target.value })}
          />
        </div>
        <div>
          <label className={label}>End</label>
          <input
            type="time"
            className={field}
            value={value.endTime || ""}
            onChange={(e) => reprice({ endTime: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Fee</label>
          <input
            className={field}
            value={value.fee || ""}
            onChange={(e) => set({ fee: e.target.value })}
            placeholder="1000"
            inputMode="decimal"
          />
          <p className="text-[10px] text-[#8a8aa0] mt-1">
            {hours
              ? `${hours % 1 ? hours.toFixed(1) : hours}h × 1000${tax ? ` − ${tax * 100}%` : ""} = ${Number(
                  feeForDuration(value.startTime, value.endTime, value.venue),
                ).toLocaleString()} THB`
              : "auto: 1000 THB/hr — edit to override"}
          </p>
        </div>
        <div>
          <label className={label}>Currency</label>
          <input
            className={field}
            value={value.currency || RATE_CURRENCY}
            onChange={(e) => set({ currency: e.target.value.toUpperCase() })}
            placeholder={RATE_CURRENCY}
            maxLength={3}
          />
        </div>
      </div>
      <div className="flex items-end gap-4 pb-1">
        <label className="flex items-center gap-2 text-sm text-[#c8c8d8]">
          <input
            type="checkbox"
            checked={!!value.paid}
            onChange={(e) => set({ paid: e.target.checked })}
          />
          Paid
        </label>
        <label className="flex items-center gap-2 text-sm text-[#c8c8d8]">
          <input
            type="checkbox"
            checked={!!value.special}
            onChange={(e) => set({ special: e.target.checked })}
          />
          Special event
        </label>
      </div>
      <div className="col-span-2">
        <label className={label}>Notes</label>
        <textarea
          className={field + " resize-y min-h-[60px]"}
          value={value.notes || ""}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Backline provided, contact @promoter, 2hr set"
        />
      </div>
      <div className={"col-span-2 grid grid-cols-2 gap-2" + (hideRecurrence ? " hidden" : "")}>
        <div>
          <label className={label}>Repeats</label>
          <select
            className={field}
            value={rec.freq || "none"}
            onChange={(e) =>
              setRec({ freq: e.target.value, count: e.target.value === "none" ? undefined : rec.count })
            }
          >
            <option value="none">Does not repeat</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        {rec.freq && rec.freq !== "none" && (
          <div>
            <label className={label}>Number of dates</label>
            <input
              type="number"
              min="1"
              max="52"
              className={field}
              value={rec.count || ""}
              onChange={(e) => setRec({ count: Number(e.target.value) || undefined })}
              placeholder="8"
            />
          </div>
        )}
      </div>
    </div>
  );
}
