// db.js — a tiny JSON-file store. Swap it for a real database later without
// touching the routes: keep this module's function signatures and you're done.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "gigs.json");

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return []; // missing or empty file → no gigs yet
  }
}

function writeAll(gigs) {
  fs.writeFileSync(FILE, JSON.stringify(gigs, null, 2));
}

export function listGigs() {
  return readAll();
}

export function getGig(id) {
  return readAll().find((g) => g.id === id) || null;
}

export function createGig(data) {
  const gigs = readAll();
  const gig = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  gigs.push(gig);
  writeAll(gigs);
  return gig;
}

export function updateGig(id, data) {
  const gigs = readAll();
  const i = gigs.findIndex((g) => g.id === id);
  if (i === -1) return null;
  gigs[i] = { ...gigs[i], ...data, id }; // id is immutable
  writeAll(gigs);
  return gigs[i];
}

export function deleteGig(id) {
  const gigs = readAll();
  const next = gigs.filter((g) => g.id !== id);
  if (next.length === gigs.length) return false;
  writeAll(next);
  return true;
}
