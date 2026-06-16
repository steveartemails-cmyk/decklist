import { useState } from "react";
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import { RATE_CURRENCY, taxForVenue } from "../config.js";

applyPlugin(jsPDF); // registers doc.autoTable

const PROFILE_KEY = "decklist.invoice.profile"; // your details + bank (global)
const RECIPIENTS_KEY = "decklist.invoice.recipients"; // "bill to" per venue

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

function todayParts() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return { dd, mm, yyyy: d.getFullYear(), human: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}` };
}

const field =
  "w-full rounded-md bg-[#15151f] border border-[#2a2a3a] px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-[#555]";
const label = "block text-xs font-medium text-[#9a9ab0] mb-1";
const section = "text-xs font-semibold uppercase tracking-wide text-[#8a8aa0] mt-4 mb-2";

// Per-venue invoice. All fields are editable. "Set as default" remembers your
// details + bank globally, and the recipient for this venue. Exports a clean,
// professional PDF (jsPDF) for saving on a phone and sending to the venue.
export default function InvoiceModal({ venue, monthLabel, monthKey, shifts, onClose }) {
  const [form, setForm] = useState(() => {
    const p = load(PROFILE_KEY);
    const r = load(RECIPIENTS_KEY)[venue] || "";
    const t = todayParts();
    return {
      name: p.name || "",
      address: p.address || "",
      email: p.email || "",
      tel: p.tel || "",
      taxId: p.taxId || "",
      companyName: p.companyName || "",
      companyAddress: p.companyAddress || "",
      bankAccountName: p.bankAccountName || "",
      bankName: p.bankName || "",
      accountNumber: p.accountNumber || "",
      accountType: p.accountType || "",
      bankBranch: p.bankBranch || "",
      attention: r,
      invoiceNumber: `${t.dd}${t.mm}${t.yyyy}`,
      dateStr: t.human,
    };
  });
  const [savedNote, setSavedNote] = useState("");
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setSavedNote("");
  };

  const sorted = [...shifts].sort((a, b) => (a.date < b.date ? -1 : 1));
  // The stored fee is the NET (after the venue's 3% withholding). The invoice
  // bills the GROSS — the venue deducts the 3% on their side — while the app's
  // report keeps showing the net the DJ actually receives.
  const taxRate = taxForVenue(venue); // 0 or 0.03
  const rows = sorted.map((s) => {
    const net = Number(s.fee) || 0;
    const gross = taxRate ? Math.round(net / (1 - taxRate)) : net;
    return { ...s, gross };
  });
  const total = rows.reduce((a, r) => a + r.gross, 0);
  const money = (n) => `${Number(n || 0).toLocaleString()} ${RATE_CURRENCY}`;

  function saveAsDefault() {
    const { attention, invoiceNumber, dateStr, ...profile } = form;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    const recips = load(RECIPIENTS_KEY);
    recips[venue] = attention;
    localStorage.setItem(RECIPIENTS_KEY, JSON.stringify(recips));
    setSavedNote("Saved as default ✓");
  }

  function downloadPDF() {
    const doc = new jsPDF();
    const M = 14;
    const right = 196;

    // Header — name (left) + INVOICE (right)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("INVOICE", right, 24, { align: "right" });
    doc.setFontSize(15);
    doc.text(form.name || "", M, 22);

    // Biller details
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let by = 30;
    const billerLines = [
      ...(form.address ? form.address.split("\n") : []),
      form.email && `E-mail: ${form.email}`,
      form.tel && `Tel: ${form.tel}`,
      form.companyName && form.companyName,
      ...(form.companyAddress ? form.companyAddress.split("\n") : []),
      form.taxId && `ID TAX : ${form.taxId}`,
    ].filter(Boolean);
    for (const line of billerLines) {
      doc.text(String(line), M, by);
      by += 5.5;
    }

    // Recipient (left) + date / invoice no (right)
    let ry = by + 6;
    const attLines = (form.attention || "").split("\n").filter(Boolean);
    if (attLines.length) {
      doc.text(`Attention: ${attLines[0]}`, M, ry);
      ry += 5.5;
      for (const l of attLines.slice(1)) {
        doc.text(l, M, ry);
        ry += 5.5;
      }
    }
    let metaY = by + 6;
    doc.text(`Date: ${form.dateStr || ""}`, right, metaY, { align: "right" });
    metaY += 5.5;
    doc.text(`Invoice No: ${form.invoiceNumber || ""}`, right, metaY, { align: "right" });

    const tableStart = Math.max(ry, metaY) + 6;

    // Shifts table
    doc.autoTable({
      startY: tableStart,
      head: [["#", "Description", "Date", "Time", `Amount (${RATE_CURRENCY})`]],
      body: rows.map((r, i) => [
        String(i + 1),
        r.eventName || "DJ performance",
        r.date,
        r.startTime && r.endTime ? `${r.startTime}–${r.endTime}` : "",
        r.gross.toLocaleString(),
      ]),
      foot: [[{ content: "Total", colSpan: 4, styles: { halign: "right" } }, total.toLocaleString()]],
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [33, 33, 45], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [240, 240, 245], textColor: 20, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 10, halign: "center" }, 4: { halign: "right" } },
    });

    // Bank detail
    let fy = doc.lastAutoTable.finalY + 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Bank Detail", M, fy);
    fy += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const bankLines = [
      form.bankAccountName && `Account Name: ${form.bankAccountName}`,
      form.bankName && `Bank Name: ${form.bankName}`,
      form.accountNumber && `Account number: ${form.accountNumber}`,
      form.accountType && `Account Type: ${form.accountType}`,
      form.bankBranch && `Branch: ${form.bankBranch}`,
    ].filter(Boolean);
    for (const line of bankLines) {
      doc.text(String(line), M, fy);
      fy += 5.5;
    }

    const safe = `${form.invoiceNumber || venue}`.replace(/[^a-z0-9-]+/gi, "-");
    doc.save(`invoice-${safe}.pdf`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl border border-[#2a2a3a] bg-[#0c0c14] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Invoice — {venue}</h2>
          <button onClick={onClose} className="text-[#8a8aa0] hover:text-white text-xl" type="button">
            ×
          </button>
        </div>

        <div className={section}>Your details</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={label}>Name</label>
            <input className={field} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="DJ DAVE DAVOTED" />
          </div>
          <div className="col-span-2">
            <label className={label}>Address</label>
            <textarea className={field + " resize-y min-h-[56px]"} value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder={"73/108 moo 4\nTambon Bophut, Koh Samui, Suratthani 84320"} />
          </div>
          <div>
            <label className={label}>Email</label>
            <input className={field} value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="davoted@yahoo.com" />
          </div>
          <div>
            <label className={label}>Tel</label>
            <input className={field} value={form.tel} onChange={(e) => set({ tel: e.target.value })} placeholder="+66 (0) 876414190" />
          </div>
          <div className="col-span-2">
            <label className={label}>Company name</label>
            <input className={field} value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} placeholder="Paradise events co., ltd." />
          </div>
          <div className="col-span-2">
            <label className={label}>Company address</label>
            <textarea className={field + " resize-y min-h-[56px]"} value={form.companyAddress} onChange={(e) => set({ companyAddress: e.target.value })} placeholder={"209/5 moo 2 Bophut Bay\nKoh Samui, Suratthani 84320"} />
          </div>
          <div className="col-span-2">
            <label className={label}>Tax ID</label>
            <input className={field} value={form.taxId} onChange={(e) => set({ taxId: e.target.value })} placeholder="0991010367601" />
          </div>
        </div>

        <div className={section}>Bill to (this venue)</div>
        <textarea
          className={field + " resize-y min-h-[56px]"}
          value={form.attention}
          onChange={(e) => set({ attention: e.target.value })}
          placeholder={"Coco Recreation Limited, 209/5 moo 2 Bophut Bay\nKoh Samui Suratthani 84320"}
        />

        <div className={section}>Invoice</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Invoice number</label>
            <input className={field} value={form.invoiceNumber} onChange={(e) => set({ invoiceNumber: e.target.value })} placeholder="21052026" />
          </div>
          <div>
            <label className={label}>Invoice date</label>
            <input className={field} value={form.dateStr} onChange={(e) => set({ dateStr: e.target.value })} placeholder="21/5/2026" />
          </div>
        </div>

        <div className={section}>Bank details</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={label}>Account name</label>
            <input className={field} value={form.bankAccountName} onChange={(e) => set({ bankAccountName: e.target.value })} placeholder="Paradise events co., ltd." />
          </div>
          <div>
            <label className={label}>Bank name</label>
            <input className={field} value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} placeholder="Siam Commercial Bank" />
          </div>
          <div>
            <label className={label}>Account number</label>
            <input className={field} value={form.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} placeholder="4120602532" />
          </div>
          <div>
            <label className={label}>Account type</label>
            <input className={field} value={form.accountType} onChange={(e) => set({ accountType: e.target.value })} placeholder="Saving" />
          </div>
          <div>
            <label className={label}>Branch</label>
            <input className={field} value={form.bankBranch} onChange={(e) => set({ bankBranch: e.target.value })} placeholder="Chaweng" />
          </div>
        </div>

        <div className="flex items-center gap-3 my-4">
          <button onClick={saveAsDefault} className="rounded-md border border-[#2a2a3a] hover:border-[#3a3a4f] px-3 py-1.5 text-xs" type="button">
            Set as default
          </button>
          {savedNote && <span className="text-xs text-emerald-300">{savedNote}</span>}
        </div>

        <div className="rounded-lg border border-[#1c1c28] overflow-hidden mb-4">
          <div className="px-3 py-2 text-xs text-[#8a8aa0] bg-[#10101a]">
            {monthLabel} · {sorted.length} shift{sorted.length === 1 ? "" : "s"}
          </div>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-1.5 text-sm border-t border-[#1c1c28]">
              <span className="text-[#c8c8d8]">
                {r.date}
                <span className="text-[#8a8aa0] ml-2 text-xs">{r.startTime && r.endTime ? `${r.startTime}–${r.endTime}` : ""}</span>
              </span>
              <span className="tabular-nums">{money(r.gross)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold border-t border-[#2a2a3a] bg-[#10101a]">
            <span>Total</span>
            <span className="tabular-nums">{money(total)}</span>
          </div>
        </div>

        <button onClick={downloadPDF} className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-medium" type="button">
          Save as PDF
        </button>
      </div>
    </div>
  );
}
