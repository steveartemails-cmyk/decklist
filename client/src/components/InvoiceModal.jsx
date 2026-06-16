import { useState } from "react";
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import { RATE_CURRENCY } from "../config.js";

applyPlugin(jsPDF); // registers doc.autoTable

const STORE_KEY = "decklist.invoice.default";

function loadDefault() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

const field =
  "w-full rounded-md bg-[#15151f] border border-[#2a2a3a] px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-[#555]";
const label = "block text-xs font-medium text-[#9a9ab0] mb-1";

// Invoice for one venue's shifts in the selected month. Biller details can be
// saved as a default (localStorage) so they're pre-filled next time. Exports a
// real PDF via jsPDF so it can be saved on a phone and sent to the venue.
export default function InvoiceModal({ venue, monthLabel, monthKey, shifts, onClose }) {
  const [biller, setBiller] = useState(loadDefault);
  const [savedNote, setSavedNote] = useState("");
  const set = (patch) => {
    setBiller((b) => ({ ...b, ...patch }));
    setSavedNote("");
  };

  const sorted = [...shifts].sort((a, b) => (a.date < b.date ? -1 : 1));
  const total = sorted.reduce((s, x) => s + (Number(x.fee) || 0), 0);
  const money = (n) => `${Number(n || 0).toLocaleString()} ${RATE_CURRENCY}`;

  function saveAsDefault() {
    localStorage.setItem(STORE_KEY, JSON.stringify(biller));
    setSavedNote("Saved as default ✓");
  }

  function downloadPDF() {
    const doc = new jsPDF();
    const left = 14;
    let y = 20;

    doc.setFontSize(20);
    doc.text("INVOICE", left, y);
    doc.setFontSize(10);
    y += 10;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, left, y);
    y += 5;
    doc.text(`Period: ${monthLabel}`, left, y);
    y += 10;

    doc.setFont(undefined, "bold");
    doc.text("From", left, y);
    doc.setFont(undefined, "normal");
    y += 5;
    for (const line of [
      biller.name,
      biller.company,
      biller.bankName && `Bank: ${biller.bankName}`,
      biller.accountNumber && `Account: ${biller.accountNumber}`,
    ].filter(Boolean)) {
      doc.text(String(line), left, y);
      y += 5;
    }

    y += 4;
    doc.setFont(undefined, "bold");
    doc.text(`Bill to: ${venue}`, left, y);
    doc.setFont(undefined, "normal");
    y += 6;

    doc.autoTable({
      startY: y,
      head: [["Date", "Time", `Amount (${RATE_CURRENCY})`]],
      body: sorted.map((s) => [
        s.date,
        s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : "",
        Number(s.fee || 0).toLocaleString(),
      ]),
      foot: [["", "Total", total.toLocaleString()]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
      footStyles: { fillColor: [230, 230, 240], textColor: 20, fontStyle: "bold" },
    });

    const safe = `${venue}-${monthKey}`.replace(/[^a-z0-9-]+/gi, "-");
    doc.save(`invoice-${safe}.pdf`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl border border-[#2a2a3a] bg-[#0c0c14] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Invoice — {venue}</h2>
          <button onClick={onClose} className="text-[#8a8aa0] hover:text-white text-xl" type="button">
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="col-span-2">
            <label className={label}>Your name</label>
            <input className={field} value={biller.name || ""} onChange={(e) => set({ name: e.target.value })} placeholder="DJ Dave Davoted" />
          </div>
          <div className="col-span-2">
            <label className={label}>Company name</label>
            <input className={field} value={biller.company || ""} onChange={(e) => set({ company: e.target.value })} placeholder="Davoted Music Co." />
          </div>
          <div>
            <label className={label}>Bank name</label>
            <input className={field} value={biller.bankName || ""} onChange={(e) => set({ bankName: e.target.value })} placeholder="Bangkok Bank" />
          </div>
          <div>
            <label className={label}>Account number</label>
            <input className={field} value={biller.accountNumber || ""} onChange={(e) => set({ accountNumber: e.target.value })} placeholder="123-4-56789-0" />
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={saveAsDefault}
            className="rounded-md border border-[#2a2a3a] hover:border-[#3a3a4f] px-3 py-1.5 text-xs"
            type="button"
          >
            Set as default
          </button>
          {savedNote && <span className="text-xs text-emerald-300">{savedNote}</span>}
        </div>

        <div className="rounded-lg border border-[#1c1c28] overflow-hidden mb-4">
          <div className="px-3 py-2 text-xs text-[#8a8aa0] bg-[#10101a]">
            {monthLabel} · {sorted.length} shift{sorted.length === 1 ? "" : "s"}
          </div>
          {sorted.map((s, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-1.5 text-sm border-t border-[#1c1c28]">
              <span className="text-[#c8c8d8]">
                {s.date}
                <span className="text-[#8a8aa0] ml-2 text-xs">
                  {s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : ""}
                </span>
              </span>
              <span className="tabular-nums">{money(s.fee)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold border-t border-[#2a2a3a] bg-[#10101a]">
            <span>Total</span>
            <span className="tabular-nums">{money(total)}</span>
          </div>
        </div>

        <button
          onClick={downloadPDF}
          className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-medium"
          type="button"
        >
          Save as PDF
        </button>
      </div>
    </div>
  );
}
