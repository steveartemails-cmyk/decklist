// Resolve the backend (Express API) base URL. Priority:
//   1. window.__DECKLIST_API__  — set in /config.js, editable after build (no rebuild)
//   2. VITE_API_BASE_URL        — baked in at build time
//   3. ""                       — same origin (dev uses the Vite proxy)
export const API_BASE =
  (typeof window !== "undefined" && window.__DECKLIST_API__) ||
  import.meta.env.VITE_API_BASE_URL ||
  "";

// Prefix an API path with the backend base.
export const apiUrl = (path) => `${API_BASE}${path}`;

// Resolve a server-relative media path (e.g. "/uploads/x.png") to the backend.
export const mediaUrl = (path) =>
  path && path.startsWith("/") ? `${API_BASE}${path}` : path;

// Source files can be images or PDFs; PDFs can't render in an <img>.
export const isPdf = (path) => /\.pdf($|\?)/i.test(path || "");

// Standard pay rate. Fees are auto-calculated from set length at this rate.
export const HOURLY_RATE = 1000;
export const RATE_CURRENCY = "THB";

// Bookable venues and their tax rate. Taxed venues pay HOURLY_RATE minus tax.
export const VENUES = [
  { name: "Ark Bar", tax: 0 },
  { name: "Love Beach", tax: 0 },
  { name: "Seen", tax: 0.03 },
  { name: "Cabanas", tax: 0.03 },
  { name: "79", tax: 0.03 },
  { name: "Other", tax: 0 },
];

// The proper-cased known venue name matching `input` (case-insensitive), or null
// if it isn't a complete known venue. Used for typeahead snapping and tax lookup.
export function canonicalVenue(input) {
  const q = String(input || "").trim().toLowerCase();
  return VENUES.find((x) => x.name.toLowerCase() === q)?.name ?? null;
}

export function taxForVenue(venue) {
  const name = canonicalVenue(venue);
  return name ? VENUES.find((x) => x.name === name).tax : 0;
}

// Set length in hours (handles midnight-crossing sets). 0 if times missing.
export function durationHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 1440;
  return mins / 60;
}

// Fee for a set as a string = hours × HOURLY_RATE, less the venue's tax.
// Returns "" if start/end times aren't both set.
export function feeForDuration(startTime, endTime, venue) {
  const hours = durationHours(startTime, endTime);
  if (!hours) return "";
  return String(Math.round(hours * HOURLY_RATE * (1 - taxForVenue(venue))));
}
