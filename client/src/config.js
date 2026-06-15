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
