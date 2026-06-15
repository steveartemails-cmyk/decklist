import { useEffect, useMemo, useState } from "react";
import * as api from "./api.js";
import { conflictingIds, addMonths, addDays, startOfWeek } from "./schedule.js";
import { downloadICS } from "./ics.js";
import UploadDropzone from "./components/UploadDropzone.jsx";
import ConfirmationCard from "./components/ConfirmationCard.jsx";
import CalendarMonth from "./components/CalendarMonth.jsx";
import CalendarWeek from "./components/CalendarWeek.jsx";
import AgendaView from "./components/AgendaView.jsx";
import GigDetail from "./components/GigDetail.jsx";
import DayPanel from "./components/DayPanel.jsx";

const monthFmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

export default function App() {
  const [gigs, setGigs] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState("month"); // month | week | agenda
  const [cursor, setCursor] = useState(new Date());
  const [drafts, setDrafts] = useState([]); // pending confirmation cards
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [addingAll, setAddingAll] = useState(false);

  useEffect(() => {
    api
      .listGigs()
      .then(setGigs)
      .catch((e) => setLoadError(e.message));
  }, []);

  const conflicts = useMemo(() => conflictingIds(gigs), [gigs]);

  async function handleFiles(files) {
    setParsing(true);
    setParseError("");
    try {
      const { drafts: newDrafts } = await api.parseScreenshots(files);
      // Give each draft a stable client id so saving/editing one never touches
      // its siblings (shifts from the same roster share a screenshotUrl).
      const withIds = newDrafts.map((d) => ({ ...d, _id: crypto.randomUUID() }));
      setDrafts((d) => [...withIds, ...d]);
    } catch (e) {
      setParseError(e.message);
    } finally {
      setParsing(false);
    }
  }

  // Edit a draft in place (clears any stale conflict/error so a normal save can
  // be retried after the user changes the time/venue).
  const updateDraft = (id, updated) =>
    setDrafts((ds) =>
      ds.map((d) => (d._id === id ? { ...updated, _id: id, _conflicts: undefined, _error: undefined } : d)),
    );

  const removeDraft = (id) => setDrafts((ds) => ds.filter((d) => d._id !== id));

  // Save one draft. Removes just that card on success; on conflict it stays with
  // its clashes flagged so the user can "Save anyway". Returns true if saved.
  async function saveDraftObj(draft, override) {
    const { _id, _conflicts, _error, _saving, ...gig } = draft;
    setDrafts((ds) => ds.map((d) => (d._id === _id ? { ...d, _saving: true, _error: undefined } : d)));
    try {
      const created = await api.createGig(gig, { override });
      setGigs((g) => [...g, created]);
      setDrafts((ds) => ds.filter((d) => d._id !== _id));
      return true;
    } catch (err) {
      setDrafts((ds) =>
        ds.map((d) =>
          d._id === _id
            ? {
                ...d,
                _saving: false,
                _conflicts: err.conflict ? err.conflicts : undefined,
                _error: err.conflict ? undefined : err.message || "Could not save.",
              }
            : d,
        ),
      );
      return false;
    }
  }

  // Add every complete draft to the calendar, one at a time so conflicts within
  // the same roster are caught. Conflicting ones stay behind, flagged.
  async function addAll() {
    setAddingAll(true);
    try {
      for (const draft of [...drafts]) {
        if (!draft.date || !draft.startTime || !draft.endTime) continue; // skip "no match"/incomplete
        await saveDraftObj(draft, false);
      }
    } finally {
      setAddingAll(false);
    }
  }

  async function saveExisting(id, gig, opts) {
    const updated = await api.updateGig(id, gig, opts);
    setGigs((g) => g.map((x) => (x.id === id ? updated : x)));
    setSelected(updated);
  }

  async function removeGig(id) {
    await api.deleteGig(id);
    setGigs((g) => g.filter((x) => x.id !== id));
    setSelected(null);
  }

  function step(delta) {
    if (view === "month") setCursor((c) => addMonths(c, delta));
    else if (view === "week") setCursor((c) => addDays(startOfWeek(c), delta * 7));
  }

  const periodLabel =
    view === "month"
      ? monthFmt.format(cursor)
      : view === "week"
        ? `Week of ${startOfWeek(cursor).toLocaleDateString()}`
        : "Upcoming";

  return (
    <div className="min-h-full max-w-5xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Decklist <span className="text-indigo-400">🎚️</span>
          </h1>
          <p className="text-sm text-[#8a8aa0]">
            Screenshot your bookings. Never double-book a gig.
          </p>
        </div>
        <button
          onClick={() => downloadICS(gigs)}
          disabled={gigs.length === 0}
          className="rounded-md border border-[#2a2a3a] hover:border-[#3a3a4f] disabled:opacity-40 px-3 py-2 text-sm"
          type="button"
        >
          Export all .ics
        </button>
      </header>

      <section className="mb-6">
        <UploadDropzone onFiles={handleFiles} busy={parsing} />
        {parsing && (
          <div className="mt-2 text-xs text-[#8a8aa0]">
            Reading… the free server can take ~30–60s to wake on the first upload, and PDFs take
            longer than screenshots. Hang tight — it's fast once it's awake.
          </div>
        )}
        {parseError && <div className="mt-2 text-sm text-rose-300">{parseError}</div>}
        {drafts.length > 0 && (
          <div className="mt-4 space-y-4">
            <h2 className="text-sm font-medium text-[#c8c8d8]">
              Review {drafts.length} read{drafts.length > 1 ? "s" : ""} before saving
            </h2>
            {drafts.map((draft) => (
              <ConfirmationCard
                key={draft._id}
                draft={draft}
                onChange={(updated) => updateDraft(draft._id, updated)}
                onSave={(override) => saveDraftObj(draft, override)}
                onDiscard={() => removeDraft(draft._id)}
                busy={addingAll}
              />
            ))}
            {drafts.length > 1 && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={addAll}
                  disabled={addingAll}
                  className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 text-sm font-medium"
                  type="button"
                >
                  {addingAll ? "Adding all…" : `Add all ${drafts.length} to calendar`}
                </button>
                <span className="text-xs text-[#8a8aa0]">
                  Conflicting shifts stay here flagged — review and “Save anyway” individually.
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {conflicts.size > 0 && (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
          ⚠ {conflicts.size} gig{conflicts.size > 1 ? "s" : ""} flagged in red have a time conflict.
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {view !== "agenda" && (
              <>
                <NavBtn onClick={() => step(-1)}>←</NavBtn>
                <NavBtn onClick={() => setCursor(new Date())}>Today</NavBtn>
                <NavBtn onClick={() => step(1)}>→</NavBtn>
              </>
            )}
            <span className="ml-1 text-sm font-medium text-[#c8c8d8]">{periodLabel}</span>
          </div>
          <div className="flex rounded-md border border-[#2a2a3a] overflow-hidden text-sm">
            {["month", "week", "agenda"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={"px-3 py-1.5 capitalize " + (view === v ? "bg-indigo-600 text-white" : "hover:bg-[#15151f]")}
                type="button"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {loadError ? (
          <div className="text-sm text-rose-300">
            Couldn't reach the API ({loadError}). Is the server running? Try{" "}
            <code className="text-rose-200">npm run dev</code>.
          </div>
        ) : view === "month" ? (
          <CalendarMonth cursor={cursor} gigs={gigs} onSelect={setSelected} onSelectDate={setSelectedDate} />
        ) : view === "week" ? (
          <CalendarWeek cursor={cursor} gigs={gigs} onSelect={setSelected} onSelectDate={setSelectedDate} />
        ) : (
          <AgendaView gigs={gigs} onSelect={setSelected} />
        )}
      </section>

      {selectedDate && (
        <DayPanel
          date={selectedDate}
          gigs={gigs}
          onSelectGig={setSelected}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {selected && (
        <GigDetail
          gig={selected}
          onClose={() => setSelected(null)}
          onSave={saveExisting}
          onDelete={removeGig}
        />
      )}
    </div>
  );
}

function NavBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-[#2a2a3a] hover:border-[#3a3a4f] px-2.5 py-1.5 text-sm"
      type="button"
    >
      {children}
    </button>
  );
}
