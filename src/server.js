// Booking webhook that Vapi calls when the agent uses checkAvailability / bookLesson.
//   pnpm server         (then expose it with `ngrok http 3000` for local testing)
import "dotenv/config";
import express from "express";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getSlots, createBooking } from "./lib/calcom.js";

const app = express();
app.use(express.json());

// Load every client config once at boot, keyed by id, so a tool call can find
// the right Cal.com calendar from the assistant's metadata.clientId.
const CLIENTS = {};
const dir = join(process.cwd(), "clients");
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const c = JSON.parse(readFileSync(join(dir, f), "utf8"));
  CLIENTS[c.id] = c;
}

function calForClient(c) {
  return {
    apiKey: c.calcom.apiKey || process.env.CALCOM_API_KEY,
    eventTypeId: c.calcom.eventTypeId,
    timeZone: c.timezone
  };
}

// Each tool handler returns a short string the agent will read/act on.
const handlers = {
  async checkAvailability(client, args) {
    const cal = calForClient(client);
    const slots = await getSlots({ ...cal, startDate: args.startDate, endDate: args.endDate });
    if (!slots.length) return "No open slots in that range. Offer to try a different day.";
    // Hand the model a small, clean set to read out.
    const shortlist = slots.slice(0, 6);
    return `Open slots (ISO, ${cal.timeZone}): ${shortlist.join(", ")}`;
  },

  async bookLesson(client, args) {
    const cal = calForClient(client);
    const booking = await createBooking({
      apiKey: cal.apiKey,
      eventTypeId: cal.eventTypeId,
      timeZone: cal.timeZone,
      start: args.start,
      name: args.name,
      email: args.email,
      phone: args.phone
    });
    return `Booked. Confirmation id ${booking.uid ?? booking.id ?? "(pending)"} for ${args.start}.`;
  }
};

app.post("/vapi/tools", async (req, res) => {
  // Optional shared-secret check.
  if (process.env.VAPI_WEBHOOK_SECRET) {
    const got = req.get("x-vapi-secret");
    if (got !== process.env.VAPI_WEBHOOK_SECRET) return res.status(401).end();
  }

  const msg = req.body?.message;
  const calls = msg?.toolCallList ?? msg?.toolCalls ?? [];
  const results = [];

  for (const call of calls) {
    const id = call.id ?? call.toolCallId;
    const name = call.function?.name ?? call.name;
    let args = call.function?.arguments ?? call.arguments ?? {};
    if (typeof args === "string") {
      try { args = JSON.parse(args); } catch { args = {}; }
    }
    // Which client? Prefer the assistant's metadata, fall back to single-client setups.
    const clientId = msg?.assistant?.metadata?.clientId ?? Object.keys(CLIENTS)[0];
    const client = CLIENTS[clientId];

    try {
      if (!client) throw new Error(`Unknown clientId: ${clientId}`);
      if (!handlers[name]) throw new Error(`Unknown tool: ${name}`);
      const result = await handlers[name](client, args);
      results.push({ toolCallId: id, result });
    } catch (err) {
      console.error(`tool ${name} failed:`, err.message);
      results.push({
        toolCallId: id,
        result: "Sorry, I couldn't reach the booking system. Take a name and number for a callback."
      });
    }
  }

  res.json({ results });
});

app.get("/health", (_req, res) => res.send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Booking server listening on :${port}`));
