// Thin wrapper around the REST API. Conflict (409) responses are surfaced as a
// structured error so the UI can show the clashing gigs and offer "Save anyway".
import { apiUrl } from "./config.js";

async function request(method, url, body) {
  const res = await fetch(apiUrl(url), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 409) {
    const data = await res.json();
    const err = new Error("conflict");
    err.conflict = true;
    err.conflicts = data.conflicts || [];
    throw err;
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error || "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || `${method} ${url} failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export const listGigs = () => request("GET", "/api/gigs");

export const createGig = (gig, { override = false } = {}) =>
  request("POST", `/api/gigs${override ? "?override=1" : ""}`, gig);

export const updateGig = (id, gig, { override = false } = {}) =>
  request("PUT", `/api/gigs/${id}${override ? "?override=1" : ""}`, gig);

export const deleteGig = (id) => request("DELETE", `/api/gigs/${id}`);

// Upload screenshots for extraction. Returns { drafts: [...] }.
export async function parseScreenshots(files) {
  const form = new FormData();
  for (const file of files) form.append("screenshots", file);
  const res = await fetch(apiUrl("/api/parse"), { method: "POST", body: form });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error || "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || "Could not read the screenshot(s).");
  }
  return res.json();
}
