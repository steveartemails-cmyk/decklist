import { useState } from "react";
import GigForm from "./GigForm.jsx";
import { downloadICS } from "../ics.js";
import { mediaUrl } from "../config.js";

// Slide-over detail panel for an existing gig: view, edit (with conflict
// re-check), export a single .ics, or delete. Shows the source screenshot.
export default function GigDetail({ gig, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(gig);
  const [editing, setEditing] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(override) {
    setSaving(true);
    setError("");
    try {
      await onSave(gig.id, draft, { override });
      setEditing(false);
      setConflicts([]);
    } catch (err) {
      if (err.conflict) setConflicts(err.conflicts);
      else setError(err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md h-full overflow-y-auto bg-[#0c0c14] border-l border-[#2a2a3a] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {gig.special && <span className="text-amber-400 mr-1">★</span>}
            {editing ? "Edit gig" : gig.eventName || gig.venue || "Gig"}
          </h2>
          <button onClick={onClose} className="text-[#8a8aa0] hover:text-white text-xl" type="button">
            ×
          </button>
        </div>

        {editing ? (
          <GigForm value={draft} onChange={setDraft} />
        ) : (
          <dl className="space-y-2 text-sm">
            <Row label="Venue" value={gig.venue} />
            <Row label="Date" value={gig.date} />
            <Row label="Time" value={gig.startTime && `${gig.startTime} – ${gig.endTime}`} />
            <Row
              label="Fee"
              value={gig.fee ? `${gig.fee} ${gig.currency} · ${gig.paid ? "paid" : "unpaid"}` : ""}
            />
            <Row
              label="Repeats"
              value={
                gig.recurrence && gig.recurrence.freq && gig.recurrence.freq !== "none"
                  ? `${gig.recurrence.freq}${gig.recurrence.count ? ` × ${gig.recurrence.count}` : ""}`
                  : ""
              }
            />
            <Row label="Notes" value={gig.notes} />
          </dl>
        )}

        {conflicts.length > 0 && (
          <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
            <div className="font-semibold text-rose-300 mb-1">⚠ Double booking</div>
            <ul className="text-rose-200/90 text-xs space-y-0.5">
              {conflicts.map((c) => (
                <li key={c.id}>
                  {c.eventName || c.venue || "Gig"} — {c.date} {c.startTime}–{c.endTime}
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}

        {gig.screenshotUrl && !editing && (
          <a href={mediaUrl(gig.screenshotUrl)} target="_blank" rel="noreferrer" className="block mt-4">
            <img
              src={mediaUrl(gig.screenshotUrl)}
              alt="source screenshot"
              className="rounded-lg border border-[#2a2a3a] w-full"
            />
            <div className="text-[10px] text-[#8a8aa0] mt-1 text-center">source screenshot</div>
          </a>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {editing ? (
            <>
              {conflicts.length === 0 ? (
                <button
                  onClick={() => save(false)}
                  disabled={saving}
                  className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium"
                  type="button"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              ) : (
                <button
                  onClick={() => save(true)}
                  disabled={saving}
                  className="rounded-md bg-rose-600 hover:bg-rose-500 px-4 py-2 text-sm font-medium"
                  type="button"
                >
                  Save anyway
                </button>
              )}
              <button
                onClick={() => {
                  setEditing(false);
                  setDraft(gig);
                  setConflicts([]);
                }}
                className="rounded-md border border-[#2a2a3a] hover:border-[#3a3a4f] px-4 py-2 text-sm"
                type="button"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium"
                type="button"
              >
                Edit
              </button>
              <button
                onClick={() => downloadICS([gig], `${(gig.eventName || gig.venue || "gig").replace(/\s+/g, "-")}.ics`)}
                className="rounded-md border border-[#2a2a3a] hover:border-[#3a3a4f] px-4 py-2 text-sm"
                type="button"
              >
                Export .ics
              </button>
              <button
                onClick={() => onDelete(gig.id)}
                className="rounded-md border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 px-4 py-2 text-sm ml-auto"
                type="button"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-[#8a8aa0]">{label}</dt>
      <dd className="text-[#e0e0ee] whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
