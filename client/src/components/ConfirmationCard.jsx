import { useState } from "react";
import GigForm from "./GigForm.jsx";
import { mediaUrl } from "../config.js";

const confidenceStyles = {
  high: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

// One editable draft read from a screenshot. The DJ confirms (and edits) before
// it's saved. Shows a confidence flag and the source screenshot, and surfaces
// any double-booking the server reported.
export default function ConfirmationCard({ draft, onSave, onDiscard }) {
  const [gig, setGig] = useState(draft);
  const [conflicts, setConflicts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const confidence = draft.confidence || "low";
  const incomplete = !gig.date || !gig.startTime || !gig.endTime;

  async function attemptSave(override) {
    setSaving(true);
    setError("");
    try {
      await onSave(gig, { override });
    } catch (err) {
      if (err.conflict) {
        setConflicts(err.conflicts);
      } else {
        setError(err.message || "Could not save.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#2a2a3a] bg-[#0f0f17] p-4">
      <div className="flex items-start justify-between mb-3 gap-3">
        <span className={"text-xs px-2 py-0.5 rounded-full border " + confidenceStyles[confidence]}>
          {draft.unreadable ? "couldn't read" : `${confidence} confidence`}
        </span>
        <button
          onClick={onDiscard}
          className="text-xs text-[#8a8aa0] hover:text-rose-300"
          type="button"
        >
          Discard
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_180px] gap-4">
        <GigForm value={gig} onChange={setGig} />
        {draft.screenshotUrl && (
          <a href={mediaUrl(draft.screenshotUrl)} target="_blank" rel="noreferrer" className="block">
            <img
              src={mediaUrl(draft.screenshotUrl)}
              alt="source screenshot"
              className="rounded-lg border border-[#2a2a3a] w-full object-cover max-h-64"
            />
            <div className="text-[10px] text-[#8a8aa0] mt-1 text-center">source screenshot</div>
          </a>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
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

      <div className="mt-4 flex items-center gap-2">
        {conflicts.length === 0 ? (
          <button
            onClick={() => attemptSave(false)}
            disabled={saving || incomplete}
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-2 text-sm font-medium"
            type="button"
          >
            {saving ? "Saving…" : "Add to calendar"}
          </button>
        ) : (
          <button
            onClick={() => attemptSave(true)}
            disabled={saving}
            className="rounded-md bg-rose-600 hover:bg-rose-500 px-4 py-2 text-sm font-medium"
            type="button"
          >
            {saving ? "Saving…" : "Save anyway"}
          </button>
        )}
        {incomplete && conflicts.length === 0 && (
          <span className="text-xs text-amber-300">Needs a date, start &amp; end time.</span>
        )}
      </div>
    </div>
  );
}
