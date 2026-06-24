import { useState } from "react";
import GigForm from "./GigForm.jsx";
import { downloadICS } from "../ics.js";
import { mediaUrl, isPdf, formatDate } from "../config.js";
import { normalizeFreq } from "../schedule.js";

// Slide-over detail panel for an existing gig: view, edit (with conflict
// re-check), export a single .ics, or delete. Shows the source screenshot.
//
// When the gig is part of a repeating series and a specific occurrence was
// clicked, Edit and Delete first ask the scope: just THIS date, or the WHOLE
// series. "This date only" splits the occurrence into its own standalone gig
// (onSaveOccurrence) or cancels just that date (onSkipOccurrence).
export default function GigDetail({ gig, onClose, onSave, onDelete, onSaveOccurrence, onSkipOccurrence }) {
  const { _occurrenceDate, ...gigClean } = gig;
  const isSeries = normalizeFreq(gig.recurrence && gig.recurrence.freq) !== "none";
  const occDate = _occurrenceDate || gig.date;

  // mode: "view" | "editSeries" | "editOccurrence"
  const [mode, setMode] = useState("view");
  const [prompt, setPrompt] = useState(null); // null | "edit" | "delete"
  const [draft, setDraft] = useState(gigClean);
  const [conflicts, setConflicts] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const editing = mode !== "view";

  function startEdit() {
    if (isSeries) {
      setPrompt("edit");
    } else {
      setDraft(gigClean);
      setMode("editSeries");
    }
  }

  function chooseEditScope(scope) {
    setPrompt(null);
    if (scope === "occurrence") {
      // Strip the series-only bits: this becomes a one-off on the clicked date.
      const { exdates, recurrence, ...rest } = gigClean;
      setDraft({ ...rest, date: occDate, recurrence: { freq: "none" } });
      setMode("editOccurrence");
    } else {
      setDraft(gigClean);
      setMode("editSeries");
    }
  }

  function cancelEdit() {
    setMode("view");
    setPrompt(null);
    setDraft(gigClean);
    setConflicts([]);
    setError("");
  }

  async function save(override) {
    setSaving(true);
    setError("");
    try {
      if (mode === "editOccurrence") {
        await onSaveOccurrence(gig.id, occDate, draft, { override });
      } else {
        await onSave(gig.id, draft, { override });
      }
      setMode("view");
      setConflicts([]);
    } catch (err) {
      if (err.conflict) setConflicts(err.conflicts);
      else setError(err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (isSeries) {
      setPrompt("delete");
      return;
    }
    onDelete(gig.id);
  }

  const title = editing
    ? mode === "editOccurrence"
      ? "Edit this date"
      : "Edit gig"
    : gig.eventName || gig.venue || "Gig";

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
            {title}
          </h2>
          <button onClick={onClose} className="text-[#8a8aa0] hover:text-white text-xl" type="button">
            ×
          </button>
        </div>

        {isSeries && !editing && (
          <div className="mb-3 rounded-md border border-indigo-500/40 bg-indigo-600/10 px-3 py-2 text-xs text-indigo-100">
            🔁 This is one date ({formatDate(occDate)}) of a repeating gig.
          </div>
        )}

        {editing ? (
          <GigForm value={draft} onChange={setDraft} hideRecurrence={mode === "editOccurrence"} />
        ) : (
          <dl className="space-y-2 text-sm">
            <Row label="Venue" value={gig.venue} />
            <Row label="Date" value={formatDate(occDate)} />
            <Row label="Time" value={gig.startTime && `${gig.startTime} – ${gig.endTime}`} />
            <Row
              label="Fee"
              value={gig.fee ? `${gig.fee} ${gig.currency} · ${gig.paid ? "paid" : "unpaid"}` : ""}
            />
            <Row
              label="Repeats"
              value={
                isSeries
                  ? `${gig.recurrence.freq}${gig.recurrence.count ? ` × ${gig.recurrence.count}` : ""}`
                  : ""
              }
            />
            <Row label="Notes" value={gig.notes} />
          </dl>
        )}

        {/* Scope chooser for a repeating gig — Edit or Delete this date vs all. */}
        {prompt && (
          <div className="mt-4 rounded-lg border border-[#2a2a3a] bg-[#10101a] p-3">
            <div className="text-sm font-medium mb-2">
              {prompt === "edit" ? "Edit which?" : "Delete which?"}
            </div>
            <div className="flex flex-col gap-2">
              {prompt === "edit" ? (
                <>
                  <button
                    onClick={() => chooseEditScope("occurrence")}
                    className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium text-left"
                    type="button"
                  >
                    Just this date ({formatDate(occDate)})
                    <div className="text-xs font-normal text-indigo-200/80">
                      Becomes its own gig — the rest of the series is untouched.
                    </div>
                  </button>
                  <button
                    onClick={() => chooseEditScope("series")}
                    className="rounded-md border border-[#2a2a3a] hover:border-[#3a3a4f] px-3 py-2 text-sm text-left"
                    type="button"
                  >
                    The whole repeating gig
                    <div className="text-xs text-[#8a8aa0]">Changes every date in the series.</div>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onSkipOccurrence(gig.id, occDate)}
                    className="rounded-md border border-rose-500/40 text-rose-200 hover:bg-rose-500/10 px-3 py-2 text-sm text-left"
                    type="button"
                  >
                    Just this date ({formatDate(occDate)})
                    <div className="text-xs text-rose-300/70">
                      Cancels this one occurrence; the rest of the series stays.
                    </div>
                  </button>
                  <button
                    onClick={() => onDelete(gig.id)}
                    className="rounded-md border border-rose-500/40 text-rose-200 hover:bg-rose-500/10 px-3 py-2 text-sm text-left"
                    type="button"
                  >
                    The whole repeating gig
                    <div className="text-xs text-rose-300/70">Removes every date in the series.</div>
                  </button>
                </>
              )}
              <button
                onClick={() => setPrompt(null)}
                className="rounded-md px-3 py-1.5 text-xs text-[#8a8aa0] hover:text-white self-start"
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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

        {gig.screenshotUrl &&
          !editing &&
          (isPdf(gig.screenshotUrl) ? (
            <a
              href={mediaUrl(gig.screenshotUrl)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center rounded-lg border border-[#2a2a3a] bg-[#15151f] p-4 mt-4 text-sm text-indigo-300 hover:border-indigo-500"
            >
              📄 open source PDF
            </a>
          ) : (
            <a href={mediaUrl(gig.screenshotUrl)} target="_blank" rel="noreferrer" className="block mt-4">
              <img
                src={mediaUrl(gig.screenshotUrl)}
                alt="source screenshot"
                className="rounded-lg border border-[#2a2a3a] w-full"
              />
              <div className="text-[10px] text-[#8a8aa0] mt-1 text-center">source screenshot</div>
            </a>
          ))}

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
                onClick={cancelEdit}
                className="rounded-md border border-[#2a2a3a] hover:border-[#3a3a4f] px-4 py-2 text-sm"
                type="button"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEdit}
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
                onClick={handleDelete}
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
