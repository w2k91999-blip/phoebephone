# AI Phone Scheduler

A reusable AI phone-booking agent for local service businesses (driving
instructors, salons, dentists…). Built on **Vapi** (voice) + **Cal.com**
(booking). Onboarding a new client is one config file + one command.

## What sounds-like-a-real-person costs

There is no fully free option — every call costs ~**$0.07–0.15/min** (phone
line + speech-to-text + AI + realistic voice). A 3-minute booking call ≈ 20–45¢.
Both Vapi and ElevenLabs give free starter credits, so testing is free.

## The irreducible manual steps (do these once)

These need *your* login + card — code can't do them for you:

1. **Vapi account** → https://dashboard.vapi.ai → copy your **private API key**.
2. **ElevenLabs voice** → pick a voice, copy its **Voice ID** (the realism lever).
   (Vapi can manage ElevenLabs for you once your keys are linked in its dashboard.)
3. **Cal.com account** (free) → create an event type called e.g. "Driving Lesson",
   note its **Event Type ID**, and make an **API key**.
4. `cp .env.example .env` and fill in `VAPI_API_KEY`, `CALCOM_API_KEY`.
5. A **phone number** — buy/import one in Vapi (~$1–2/mo) and point it at the
   assistant id this tool prints.

## Per-client setup (repeat for each business you resell to)

1. Copy `clients/driving-instructor.json` → `clients/<new-client>.json`.
2. Fill in business name, voice id, Cal.com `eventTypeId`, prices, FAQ.
3. Start the booking server and expose it:
   ```bash
   pnpm server          # in one terminal
   ngrok http 3000      # in another — paste the https URL into .env as SERVER_URL
   ```
4. Provision the agent:
   ```bash
   pnpm provision <new-client>
   ```
   First run creates the agent and saves its id back into the client file;
   later runs update it. Then attach a phone number to that assistant in Vapi.

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm provision <client>` | Create/update that client's voice agent |
| `pnpm list` | List all agents in your Vapi account |
| `pnpm server` | Run the Cal.com booking webhook |

## Files

- `clients/*.json` — one file per business (the only thing you edit per client)
- `src/assistant-template.js` — the agent's personality, prompt, and tools
- `src/provision.js` — pushes a client config to Vapi
- `src/server.js` + `src/lib/calcom.js` — booking against Cal.com

## Notes

- Cal.com's API versions move; if slots/bookings 4xx, check the `cal-api-version`
  values in `src/lib/calcom.js` against the current docs.
- The agent uses `gpt-4o-mini` as a cheap brain — swap in `model` if a client
  needs something stronger.
