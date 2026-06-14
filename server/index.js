// index.js — the Decklist REST API.
//
//   GET    /api/gigs            list all gigs
//   POST   /api/gigs            create a gig; 409 + conflicts unless ?override=1
//   PUT    /api/gigs/:id        update a gig; same conflict check (excludes self)
//   DELETE /api/gigs/:id        remove a gig
//   POST   /api/parse           multipart screenshots -> Claude vision -> drafts
//   GET    /uploads/*           the stored source screenshots
import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as db from "./db.js";
import { findConflicts } from "./scheduling.js";
import { parseScreenshot } from "./parse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

app.get("/api/gigs", (_req, res) => {
  res.json(db.listGigs());
});

app.post("/api/gigs", (req, res) => {
  const gig = req.body;
  const conflicts = findConflicts(gig, db.listGigs());
  if (conflicts.length && req.query.override !== "1") {
    return res.status(409).json({ error: "conflict", conflicts });
  }
  res.status(201).json(db.createGig(gig));
});

app.put("/api/gigs/:id", (req, res) => {
  const gig = { ...req.body, id: req.params.id };
  const conflicts = findConflicts(gig, db.listGigs());
  if (conflicts.length && req.query.override !== "1") {
    return res.status(409).json({ error: "conflict", conflicts });
  }
  const updated = db.updateGig(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "not found" });
  res.json(updated);
});

app.delete("/api/gigs/:id", (req, res) => {
  const ok = db.deleteGig(req.params.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

app.post("/api/parse", upload.array("screenshots", 20), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "no screenshots uploaded" });
    const drafts = [];
    for (const file of files) {
      const draft = await parseScreenshot(file);
      drafts.push({ ...draft, screenshotUrl: `/uploads/${file.filename}` });
    }
    res.json({ drafts });
  } catch (err) {
    console.error("parse failed:", err);
    res.status(500).json({ error: err.message || "extraction failed" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Decklist API on http://localhost:${PORT}`);
});
