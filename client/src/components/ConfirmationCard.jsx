import GigForm from "./GigForm.jsx";
import { mediaUrl, isPdf, formatDate } from "../config.js";

const confidenceStyles = {
  high: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

// One editable draft read from a screenshot/roster. Fully controlled — the draft
// (including any conflict/error/saving flags) lives in the parent so "Add all"
// can save every card with the user's edits. The DJ confirms before it's saved.
export default function ConfirmationCard({ draft, onChange, onSave, onDiscard, busy }) {
  const confidence = draft.confidence || "low";
  const incomplete = !draft.date || !draft.startTime || !draft.endTime;
  const conflicts = draft._conflicts || [];
  const saving = draft._saving;

  return (
    <div className="rounded-xl border border-[#2a2a3a] bg-[#0f0f17] p-4">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={"text-xs px-2 py-0.5 rounded-full border " + confidenceStyles[confidence]}>
            {draft.unreadable ? "no match" : `${confidence} confidence`}
          </span>
          {draft.matchedName && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-indigo-500/40 bg-indigo-500/15 text-indigo-200">
              matched: {draft.matchedName}
            </span>
          )}
        </div>
        <button
          onClick={onDiscard}
          disabled={busy}
          className="text-xs text-[#8a8aa0] hover:text-rose-300 disabled:opacity-40"
          type="button"
        >
          Discard
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_180px] gap-4">
        <GigForm value={draft} onChange={onChange} />
        {draft.screenshotUrl &&
          (isPdf(draft.screenshotUrl) ? (
            <a
              href={mediaUrl(draft.screenshotUrl)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center rounded-lg border border-[#2a2a3a] bg-[#15151f] p-4 text-sm text-indigo-300 hover:border-indigo-500"
            >
              📄 open source PDF
            </a>
          ) : (
            <a href={mediaUrl(draft.screenshotUrl)} target="_blank" rel="noreferrer" className="block">
              <img
                src={mediaUrl(draft.screenshotUrl)}
                alt="source screenshot"
                className="rounded-lg border border-[#2a2a3a] w-full object-cover max-h-64"
              />
              <div className="text-[10px] text-[#8a8aa0] mt-1 text-center">source screenshot</div>
            </a>
          ))}
      </div>

      {conflicts.length > 0 && (
        <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
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

      {draft._error && <div className="mt-3 text-sm text-rose-300">{draft._error}</div>}

      <div className="mt-4 flex items-center gap-2">
        {conflicts.length === 0 ? (
          <button
            onClick={() => onSave(false)}
            disabled={saving || busy || incomplete}
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-2 text-sm font-medium"
            type="button"
          >
            {saving ? "Saving…" : "Add to calendar"}
          </button>
        ) : (
          <button
            onClick={() => onSave(true)}
            disabled={saving || busy}
            className="rounded-md bg-rose-600 hover:bg-rose-500 disabled:opacity-40 px-4 py-2 text-sm font-medium"
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
