// A controlled editor for a gig's fields. Reused by the confirmation cards (when
// reviewing a screenshot read) and by the edit panel.
const field = "w-full rounded-md bg-[#15151f] border border-[#2a2a3a] px-3 py-2 text-sm " +
  "focus:outline-none focus:border-indigo-500 placeholder:text-[#555]";
const label = "block text-xs font-medium text-[#9a9ab0] mb-1";

export default function GigForm({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const setRec = (patch) =>
    onChange({ ...value, recurrence: { ...(value.recurrence || { freq: "none" }), ...patch } });
  const rec = value.recurrence || { freq: "none" };

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
          className={field}
          value={value.venue || ""}
          onChange={(e) => set({ venue: e.target.value })}
          placeholder="Club Aurora"
        />
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
            onChange={(e) => set({ startTime: e.target.value })}
          />
        </div>
        <div>
          <label className={label}>End</label>
          <input
            type="time"
            className={field}
            value={value.endTime || ""}
            onChange={(e) => set({ endTime: e.target.value })}
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
            placeholder="250"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className={label}>Currency</label>
          <input
            className={field}
            value={value.currency || ""}
            onChange={(e) => set({ currency: e.target.value.toUpperCase() })}
            placeholder="USD"
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
      <div className="col-span-2 grid grid-cols-2 gap-2">
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
