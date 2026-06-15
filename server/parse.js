// parse.js — turn a booking screenshot OR a roster/lineup (image or PDF) into
// structured gig drafts using Claude's vision. The file may list many acts; we
// only keep the sets performed by our artist (see ARTIST_ALIASES). The API key
// lives only here (read from server/.env) and never reaches the browser.
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

// Vision-capable, current Opus. Do not append a date suffix to this id.
const MODEL = "claude-opus-4-8";

// Names that all refer to the artist we represent. Override in server/.env.
const ARTIST_ALIASES = (process.env.ARTIST_ALIASES || "Dave,Davoted,Dave Davoted,Nvara")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const IMAGE_MEDIA_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

// One extracted set. The model returns a list of these — only for our artist.
const GIG_ITEM = {
  type: "object",
  additionalProperties: false,
  properties: {
    matchedName: { type: "string", description: "Which artist name on the bill this set belongs to." },
    eventName: { type: "string", description: "Event / party / club night name, or '' if none." },
    venue: { type: "string", description: "Venue or club name, or '' if not stated." },
    date: { type: "string", description: "Gig date as YYYY-MM-DD, or '' if not determinable." },
    startTime: { type: "string", description: "Set start as 24h HH:MM, or '' if not stated." },
    endTime: { type: "string", description: "Set end as 24h HH:MM, or '' if not stated." },
    fee: { type: "string", description: "Fee amount as digits only e.g. '250', or '' if not stated." },
    currency: { type: "string", description: "ISO currency code e.g. 'USD','GBP','EUR', or '' if unknown." },
    notes: { type: "string", description: "Stage/room, set length, contact, or other detail. '' if none." },
    confidence: { type: "string", enum: ["high", "medium", "low"], description: "Read confidence for this set." },
  },
  required: [
    "matchedName", "eventName", "venue", "date", "startTime",
    "endTime", "fee", "currency", "notes", "confidence",
  ],
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    gigs: { type: "array", items: GIG_ITEM, description: "One entry per set performed by our artist." },
    unreadable: { type: "boolean", description: "True if the file isn't a booking/roster or can't be read." },
    note: { type: "string", description: "If gigs is empty, briefly say why (e.g. 'artist not on this bill')." },
  },
  required: ["gigs", "unreadable", "note"],
};

function buildPrompt(today) {
  const names = ARTIST_ALIASES.map((n) => `"${n}"`).join(", ");
  return `You are reading a DJ booking. It may be a single offer (DM, text, email) OR a full roster / lineup / festival timetable (flyer or multi-page PDF) listing many artists and set times.

Extract ONLY the set(s) performed by the artist we represent, who appears under any of these names — treat them ALL as the same one person: ${names}.
- Match case-insensitively; ignore surrounding text, emoji, and "b2b"/"vs" formatting. If a name in the list appears anywhere as a performing act, it's a match.
- IGNORE every other act on the bill.
- The same artist may appear more than once (multiple days, stages, or rooms). Return one entry per distinct set.
- If none of these names appear, return "gigs": [] and explain in "note".

For each matched set:
- date → strict YYYY-MM-DD. Resolve relative dates ("this Friday") against today's date below. If the year is missing, pick the nearest sensible upcoming date.
- times → 24-hour HH:MM. "11pm-3am" → start 23:00, end 03:00. If only a start is given, leave endTime "".
- fee → digits only, no symbol; put the symbol/code in currency.
- Use "" for any field genuinely not present — never guess.

Today's date is ${today}.`;
}

// Build the right content block for the file type (image vs PDF).
function fileContentBlock(file) {
  const ext = (file.originalname.match(/\.[a-z0-9]+$/i)?.[0] || "").toLowerCase();
  const data = fs.readFileSync(file.path).toString("base64");
  const isPdf = ext === ".pdf" || file.mimetype === "application/pdf";
  if (isPdf) {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  const media = IMAGE_MEDIA_TYPES[ext] || file.mimetype || "image/png";
  return { type: "image", source: { type: "base64", media_type: media, data } };
}

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy server/.env.example to server/.env and add your key.",
    );
  }
  return new Anthropic({ apiKey });
}

function normalize(item) {
  return {
    matchedName: item.matchedName || "",
    eventName: item.eventName || "",
    venue: item.venue || "",
    date: item.date || "",
    startTime: item.startTime || "",
    endTime: item.endTime || "",
    fee: item.fee || "",
    currency: item.currency || "",
    notes: item.notes || "",
    confidence: item.confidence || "low",
    unreadable: false,
    special: false,
    paid: false,
    recurrence: { freq: "none" },
  };
}

// Returns an array of draft gigs for one uploaded file. Empty matches come back
// as a single "no match" draft so the user gets feedback they can dismiss.
export async function parseScreenshot(file) {
  const today = new Date().toISOString().slice(0, 10);

  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [fileContentBlock(file), { type: "text", text: buildPrompt(today) }],
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = { gigs: [], unreadable: true, note: "Could not parse the model response." };
  }

  const gigs = Array.isArray(result.gigs) ? result.gigs : [];
  if (gigs.length === 0) {
    const reason = result.unreadable
      ? "Couldn't read this file."
      : result.note || `No sets for ${ARTIST_ALIASES.join(" / ")} found on this bill.`;
    return [
      {
        ...normalize({ confidence: "low" }),
        unreadable: true,
        notes: reason,
      },
    ];
  }
  return gigs.map(normalize);
}
