import { useRef, useState } from "react";

// Drag-and-drop (or click) zone for booking screenshots. Hands the chosen files
// up to the parent, which sends them to /api/parse.
export default function UploadDropzone({ onFiles, busy }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const pick = (fileList) => {
    const files = [...fileList].filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf",
    );
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={
        "cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition " +
        (dragging
          ? "border-indigo-400 bg-indigo-500/10"
          : "border-[#2a2a3a] hover:border-[#3a3a4f] bg-[#101018]")
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => pick(e.target.files)}
      />
      <div className="text-2xl mb-1">{busy ? "⏳" : "🎛️"}</div>
      <div className="text-sm font-medium">
        {busy ? "Reading your bookings…" : "Drop booking screenshots or roster PDFs here"}
      </div>
      <div className="text-xs text-[#8a8aa0] mt-1">
        DMs, flyers, emails, texts, full lineups — Claude pulls out your sets only
      </div>
    </div>
  );
}
