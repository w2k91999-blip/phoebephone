// Booking webhook that Vapi calls when the agent uses checkAvailability / bookLesson.
//   pnpm server         (then expose it with `ngrok http 3000` for local testing)
import "dotenv/config";
import express from "express";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Stripe from "stripe";
import { getSlots, createBooking } from "./lib/calcom.js";

const app = express();

// Stripe webhook needs the raw body — register BEFORE express.json()
app.use("/stripe/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.static(join(process.cwd(), 'website')));

// ── Stripe / Supabase setup ──────────────────────────────────────────────────
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-06-30" })
  : null;

const SB_URL          = process.env.SUPABASE_URL          || "https://lrxuflxfnyiqzjqzjcsa.supabase.co";
const SB_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Price ID → plan name map (set these in .env)
const PRICE_TO_PLAN = {
  [process.env.STRIPE_PRICE_BASIC]:        "basic",
  [process.env.STRIPE_PRICE_PROFESSIONAL]: "professional",
  [process.env.STRIPE_PRICE_PREMIUM]:      "premium",
};

async function sbFetch(path, method, body) {
  const res = await fetch(`${SB_URL}/rest/v1${path}`, {
    method,
    headers: {
      "Content-Type":  "application/json",
      "apikey":        SB_SERVICE_KEY,
      "Authorization": `Bearer ${SB_SERVICE_KEY}`,
      "Prefer":        "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text}`);
  }
}

function planFromSession(session, lineItems) {
  // 1. Check session metadata (set on Stripe Payment Link)
  if (session.metadata?.plan) return session.metadata.plan;
  // 2. Map price ID from line items
  const priceId = lineItems?.data?.[0]?.price?.id;
  return PRICE_TO_PLAN[priceId] || null;
}

// ── Stripe webhook ───────────────────────────────────────────────────────────
app.post("/stripe/webhook", async (req, res) => {
  const sig    = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    console.error("Stripe not configured — set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET");
    return res.status(500).end();
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Stripe event: ${event.type}`);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId  = session.client_reference_id;

      if (!userId) {
        console.warn("checkout.session.completed missing client_reference_id — skipping");
        return res.json({ received: true });
      }

      if (!SB_SERVICE_KEY) {
        console.error("SUPABASE_SERVICE_ROLE_KEY not set — cannot update profile");
        return res.json({ received: true });
      }

      // Fetch line items to determine which plan was purchased
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      const plan = planFromSession(session, lineItems);

      if (!plan) {
        console.warn("Could not determine plan from session", session.id);
      } else {
        // Activate the plan on the user's profile
        await sbFetch(`/profiles?id=eq.${userId}`, "PATCH", {
          plan,
          stripe_customer_id: session.customer || null,
          stripe_subscription_id: session.subscription || null,
        });
        console.log(`Plan activated: ${plan} for user ${userId}`);
      }

      // Record the payment
      const amountPence = session.amount_total ?? 0;
      await sbFetch("/payments", "POST", {
        owner_id:          userId,
        stripe_session_id: session.id,
        amount_pence:      amountPence,
        plan:              plan || "unknown",
        status:            "succeeded",
        paid_at:           new Date().toISOString(),
      });
    }

    else if (event.type === "customer.subscription.deleted") {
      const sub    = event.data.object;
      const custId = sub.customer;

      if (!SB_SERVICE_KEY || !custId) return res.json({ received: true });

      // Find the user by stripe_customer_id and remove their plan
      await sbFetch(`/profiles?stripe_customer_id=eq.${custId}`, "PATCH", {
        plan: "cancelled",
        stripe_subscription_id: null,
      });
      console.log(`Subscription cancelled for Stripe customer ${custId}`);
    }

    else if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      // Only record renewals (not the first payment, which is covered by checkout.session.completed)
      if (invoice.billing_reason === "subscription_cycle" && SB_SERVICE_KEY) {
        const custId = invoice.customer;
        // Look up the user by stripe_customer_id
        const profRes = await fetch(`${SB_URL}/rest/v1/profiles?stripe_customer_id=eq.${custId}&select=id,plan`, {
          headers: { "apikey": SB_SERVICE_KEY, "Authorization": `Bearer ${SB_SERVICE_KEY}` }
        });
        const [prof] = await profRes.json();
        if (prof) {
          await sbFetch("/payments", "POST", {
            owner_id:     prof.id,
            amount_pence: invoice.amount_paid,
            plan:         prof.plan || "unknown",
            status:       "succeeded",
            paid_at:      new Date(invoice.status_transitions.paid_at * 1000).toISOString(),
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err.message);
    // Return 200 so Stripe doesn't keep retrying for non-fixable errors
  }

  res.json({ received: true });
});

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
