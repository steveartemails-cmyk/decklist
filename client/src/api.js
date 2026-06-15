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

// Upload screenshots/PDFs for extraction. Returns { drafts: [...] }.
// Aborts with a friendly message instead of hanging forever — useful when the
// free backend is waking from sleep or a large PDF is slow to read.
export async function parseScreenshots(files) {
  const form = new FormData();
  for (const file of files) form.append("screenshots", file);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 175000); // ~3 min ceiling
  let res;
  try {
    res = await fetch(apiUrl("/api/parse"), { method: "POST", body: form, signal: ctrl.signal });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(
        "Timed out reading the file. The server may have been asleep, or the PDF is large — wait a few seconds and try again (it's usually fast the second time).",
      );
    }
    throw new Error("Couldn't reach the server — it may be waking up. Try again in a moment.");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error || "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || "Could not read the file(s).");
  }
  return res.json();
}
