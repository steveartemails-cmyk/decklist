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

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "decklist-api" });
});

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

app.get("/api/gigs", async (_req, res) => {
  try {
    res.json(await db.listGigs());
  } catch (err) {
    console.error("listGigs failed:", err);
    res.status(500).json({ error: "could not load gigs" });
  }
});

app.post("/api/gigs", async (req, res) => {
  try {
    const gig = req.body;
    const conflicts = findConflicts(gig, await db.listGigs());
    if (conflicts.length && req.query.override !== "1") {
      return res.status(409).json({ error: "conflict", conflicts });
    }
    res.status(201).json(await db.createGig(gig));
  } catch (err) {
    console.error("createGig failed:", err);
    res.status(500).json({ error: "could not save gig" });
  }
});

app.put("/api/gigs/:id", async (req, res) => {
  try {
    const gig = { ...req.body, id: req.params.id };
    const conflicts = findConflicts(gig, await db.listGigs());
    if (conflicts.length && req.query.override !== "1") {
      return res.status(409).json({ error: "conflict", conflicts });
    }
    const updated = await db.updateGig(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(updated);
  } catch (err) {
    console.error("updateGig failed:", err);
    res.status(500).json({ error: "could not update gig" });
  }
});

app.delete("/api/gigs/:id", async (req, res) => {
  try {
    const ok = await db.deleteGig(req.params.id);
    if (!ok) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  } catch (err) {
    console.error("deleteGig failed:", err);
    res.status(500).json({ error: "could not delete gig" });
  }
});

app.post("/api/parse", upload.array("screenshots", 20), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "no screenshots uploaded" });
    const drafts = [];
    for (const file of files) {
      const matches = await parseScreenshot(file); // array — a roster may yield several
      for (const draft of matches) {
        drafts.push({ ...draft, screenshotUrl: `/uploads/${file.filename}` });
      }
    }
    res.json({ drafts });
  } catch (err) {
    console.error("parse failed:", err);
    res.status(500).json({ error: err.message || "extraction failed" });
  }
});

const PORT = process.env.PORT || 3001;
db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `Decklist API on http://localhost:${PORT} (storage: ${
          db.usingDatabase() ? "Postgres" : "JSON file"
        })`,
      );
    });
  })
  .catch((err) => {
    console.error("Database init failed:", err);
    process.exit(1);
  });
