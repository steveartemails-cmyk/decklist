// db.js — gig storage.
//
// If DATABASE_URL is set (e.g. a Supabase Postgres connection string) gigs are
// stored in a `gigs` table that survives restarts/redeploys. Otherwise it falls
// back to a local JSON file so development works with no database to install.
//
// Each gig is stored whole, as a JSONB blob keyed by id, so the schema never
// needs to change as gig fields evolve. All functions are async.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "gigs.json");

// Lazily wire up Postgres only when a connection string is provided.
let pool = null;
if (process.env.DATABASE_URL) {
  const { default: pg } = await import("pg");
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Supabase requires SSL
  });
}

export function usingDatabase() {
  return Boolean(pool);
}

// Create the table on startup (no-op for the JSON fallback).
export async function init() {
  if (!pool) return;
  await pool.query(
    `create table if not exists gigs (
       id text primary key,
       data jsonb not null,
       created_at timestamptz not null default now()
     )`,
  );
}

// ---- JSON-file fallback helpers ----
function readFile() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}
function writeFile(gigs) {
  fs.writeFileSync(FILE, JSON.stringify(gigs, null, 2));
}

export async function listGigs() {
  if (pool) {
    const { rows } = await pool.query("select data from gigs order by created_at asc");
    return rows.map((r) => r.data);
  }
  return readFile();
}

export async function getGig(id) {
  if (pool) {
    const { rows } = await pool.query("select data from gigs where id = $1", [id]);
    return rows[0]?.data ?? null;
  }
  return readFile().find((g) => g.id === id) ?? null;
}

export async function createGig(data) {
  const gig = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  if (pool) {
    // node-postgres JSON-stringifies object params for a jsonb column.
    await pool.query("insert into gigs (id, data, created_at) values ($1, $2, $3)", [
      gig.id,
      gig,
      gig.createdAt,
    ]);
    return gig;
  }
  const gigs = readFile();
  gigs.push(gig);
  writeFile(gigs);
  return gig;
}

export async function updateGig(id, patch) {
  if (pool) {
    const { rows } = await pool.query("select data from gigs where id = $1", [id]);
    if (!rows[0]) return null;
    const updated = { ...rows[0].data, ...patch, id }; // id is immutable
    await pool.query("update gigs set data = $2 where id = $1", [id, updated]);
    return updated;
  }
  const gigs = readFile();
  const i = gigs.findIndex((g) => g.id === id);
  if (i === -1) return null;
  gigs[i] = { ...gigs[i], ...patch, id };
  writeFile(gigs);
  return gigs[i];
}

export async function deleteGig(id) {
  if (pool) {
    const { rowCount } = await pool.query("delete from gigs where id = $1", [id]);
    return rowCount > 0;
  }
  const gigs = readFile();
  const next = gigs.filter((g) => g.id !== id);
  if (next.length === gigs.length) return false;
  writeFile(next);
  return true;
}
