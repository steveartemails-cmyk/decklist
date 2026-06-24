import { useState } from "react";
import GigForm from "./GigForm.jsx";
import { RATE_CURRENCY, formatDate } from "../config.js";

// A fresh, empty shift for the given date. Venue blank (typeahead fills it),
// everything else blank; the fee auto-derives from times × rate − venue tax.
const blankGig = (date) => ({
  eventName: "",
  venue: "",
  date: date || "",
  startTime: "",
  endTime: "",
  fee: "",
  currency: RATE_CURRENCY,
  paid: false,
  special: false,
  notes: "",
  recurrence: { freq: "none" },
});

// Slide-over for entering a shift by hand (opened from a date's day panel).
export default function NewShiftPanel({ date, onClose, onCreate }) {
  const [gig, setGig] = useState(() => blankGig(date));
  const [conflicts, setConflicts] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const incomplete = !gig.date || !gig.startTime || !gig.endTime;

  async function save(override) {
    setSaving(true);
    setError("");
    try {
      await onCreate(gig, { override });
      onClose();
    } catch (err) {
      if (err.conflict) setConflicts(err.conflicts);
      else setError(err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md h-full overflow-y-auto bg-[#0c0c14] border-l border-[#2a2a3a] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add a shift</h2>
          <button onClick={onClose} className="text-[#8a8aa0] hover:text-white text-xl" type="button">
            ×
          </button>
        </div>

        <GigForm
          value={gig}
          onChange={(updated) => {
            setGig(updated);
            setConflicts([]); // editing invalidates a prior clash
            setError("");
          }}
        />

        {conflicts.length > 0 && (
          <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
            <div className="font-semibold text-rose-300 mb-1">⚠ Double booking</div>
            <ul className="text-rose-200/90 text-xs space-y-0.5">
              {conflicts.map((c) => (
                <li key={c.id}>
                  {c.eventName || c.venue || "Gig"} — {formatDate(c.date)} {c.startTime}–{c.endTime}
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}

        <div className="mt-6 flex items-center gap-2">
          {conflicts.length === 0 ? (
            <button
              onClick={() => save(false)}
              disabled={saving || incomplete}
              className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-2 text-sm font-medium"
              type="button"
            >
              {saving ? "Saving…" : "Add to calendar"}
            </button>
          ) : (
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="rounded-md bg-rose-600 hover:bg-rose-500 disabled:opacity-40 px-4 py-2 text-sm font-medium"
              type="button"
            >
              {saving ? "Saving…" : "Save anyway"}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md border border-[#2a2a3a] hover:border-[#3a3a4f] px-4 py-2 text-sm"
            type="button"
          >
            Cancel
          </button>
          {incomplete && conflicts.length === 0 && (
            <span className="text-xs text-amber-300">Needs a start &amp; end time.</span>
          )}
        </div>
      </div>
    </div>
  );
}
