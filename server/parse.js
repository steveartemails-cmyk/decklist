// parse.js — turn a booking screenshot into a structured gig draft using Claude's
// vision. The API key lives only here (read from server/.env) and never reaches
// the browser.
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

// Vision-capable, current Opus. Do not append a date suffix to this id.
const MODEL = "claude-opus-4-8";

const MEDIA_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

// Structured output schema — the API guarantees the response matches this shape,
// so there's no brittle JSON-from-prose parsing.
const GIG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    eventName: { type: "string", description: "Event / party / club night name, or '' if none." },
    venue: { type: "string", description: "Venue or club name, or '' if not stated." },
    date: { type: "string", description: "Gig date as YYYY-MM-DD, or '' if not determinable." },
    startTime: { type: "string", description: "Set start as 24h HH:MM, or '' if not stated." },
    endTime: { type: "string", description: "Set end as 24h HH:MM, or '' if not stated." },
    fee: { type: "string", description: "Fee amount as digits only e.g. '250', or '' if not stated." },
    currency: { type: "string", description: "ISO currency code e.g. 'USD','GBP','EUR', or '' if unknown." },
    notes: { type: "string", description: "Any extra detail: contact, backline, dress code, etc. '' if none." },
    confidence: { type: "string", enum: ["high", "medium", "low"], description: "Overall read confidence." },
    unreadable: { type: "boolean", description: "True if the image is not a booking offer or can't be read." },
  },
  required: [
    "eventName", "venue", "date", "startTime", "endTime",
    "fee", "currency", "notes", "confidence", "unreadable",
  ],
};

const PROMPT = `You are reading a DJ booking offer from a screenshot — it may be a DM, flyer, email, or text message.

Extract the booking details into the structured fields. Rules:
- Dates: resolve relative dates ("this Friday", "next Sat") against today's date provided below, and output strict YYYY-MM-DD. If the year is missing, choose the nearest sensible upcoming date.
- Times: convert to 24-hour HH:MM. "11pm-3am" → start 23:00, end 03:00. If only a start is given, leave endTime "".
- Fee: digits only, no currency symbol. Put the symbol/code in currency.
- If a field genuinely isn't present, use "" (empty string) — never guess.
- Set confidence to "low" and unreadable to true if the image is blurry, not a booking, or you can't extract a date/time.`;

function mediaTypeFor(file) {
  const ext = (file.originalname.match(/\.[a-z0-9]+$/i)?.[0] || "").toLowerCase();
  return MEDIA_TYPES[ext] || file.mimetype || "image/png";
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

export async function parseScreenshot(file) {
  const data = fs.readFileSync(file.path);
  const today = new Date().toISOString().slice(0, 10);

  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema: GIG_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaTypeFor(file), data: data.toString("base64") },
          },
          { type: "text", text: `${PROMPT}\n\nToday's date is ${today}.` },
        ],
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
  let draft;
  try {
    draft = JSON.parse(text);
  } catch {
    draft = { unreadable: true, confidence: "low", notes: "Could not parse the model response." };
  }

  // Normalise into the shape the client expects for an editable gig.
  return {
    eventName: draft.eventName || "",
    venue: draft.venue || "",
    date: draft.date || "",
    startTime: draft.startTime || "",
    endTime: draft.endTime || "",
    fee: draft.fee || "",
    currency: draft.currency || "",
    notes: draft.notes || "",
    confidence: draft.confidence || "low",
    unreadable: Boolean(draft.unreadable),
    special: false,
    paid: false,
    recurrence: { freq: "none" },
  };
}
