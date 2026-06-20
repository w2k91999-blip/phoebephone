# Phone Phoebe

**The AI receptionist for UK small businesses.** Phoebe answers every call, captures job details and texts them straight to your phone — 24/7, from £39/month.

Built on **Vapi** (voice AI) + **Cal.com** (booking) + **Supabase** (auth & database) + **Stripe** (payments) + **Resend** (email).

---

## What it does

- Answers calls when you're busy or unavailable, sounding like a real receptionist
- Captures caller name, number and job details — texts them straight to you
- Books jobs or lessons directly into your Cal.com calendar
- Signs customers up via the marketing website with a 7-day free trial
- Automatically nurtures trial users through a 7-email sequence to convert them to paid

---

## Project structure

```
├── website/              Marketing site + auth-gated app
│   ├── index.html        Landing page (hero, how it works, pricing, FAQ)
│   ├── dashboard.html    Customer dashboard (calls, bookings, agent, billing)
│   ├── admin.html        Internal admin panel (users, subscriptions overview)
│   ├── about.html        About page
│   ├── privacy.html      Privacy policy
│   ├── terms.html        Terms of service
│   └── assets/           CSS (styles, dashboard, admin) + logo
├── supabase/
│   ├── setup.sql         One-shot SQL: nurture table, pg_cron job, DB trigger
│   └── functions/
│       ├── on-signup/    Edge Function: fires on email confirm, sends Email 1
│       └── send-nurture/ Edge Function: hourly cron, sends Emails 2–7
├── src/
│   ├── server.js         Express server: Stripe webhook + Vapi tool handler
│   ├── assistant-template.js  Vapi agent personality and tool definitions
│   ├── provision.js      Pushes client config to Vapi (create/update)
│   ├── list.js           Lists all Vapi agents in your account
│   └── lib/calcom.js     Cal.com slot fetching and booking
├── clients/              One JSON file per business you onboard
├── scripts/
│   └── stripe-setup.js   Creates Stripe products, prices, and payment links
└── marketing/            Brand voice, email copy, ad scripts, social content
```

---

## Website & auth

The marketing site is a static multi-page HTML/CSS site served by the Express server. It uses **Supabase Auth** (email + password) for sign-up and log-in.

- Sign-up creates a Supabase user and triggers the email nurture flow on email confirmation
- The dashboard (`dashboard.html`) is auth-gated — redirects to the landing page if not logged in
- The admin panel (`admin.html`) is gated to a hardcoded admin user ID

**Dashboard sections:**

| Section | What it shows |
|---|---|
| Home | Trial/plan banner, setup checklist, quick stats |
| Call logs | Transcripts of all calls Phoebe has handled |
| Bookings | Upcoming and past bookings from Cal.com |
| My agent | Agent configuration and Phoebe's number |
| Subscription | Plan details, upgrade/downgrade, billing |
| Account | Email, password, preferences |

---

## Payments (Stripe)

Three subscription tiers, billed monthly in GBP:

| Plan | Price | Notes |
|---|---|---|
| Basic | £39/month | Core call answering + text alerts |
| Professional | £89/month | Includes full calendar booking |
| Premium | £189/month | White-glove setup + priority support |

**How it works end-to-end:**

1. Customer clicks a plan CTA on the landing page or dashboard
2. Stripe Checkout opens — the Supabase `user_id` is passed as `client_reference_id`
3. On `checkout.session.completed`, the Stripe webhook (`POST /stripe/webhook`) activates the plan on the user's `profiles` row in Supabase
4. Subscription renewals (`invoice.payment_succeeded`) and cancellations (`customer.subscription.deleted`) are also handled and written to a `payments` table

**Setup:** `pnpm stripe-setup` creates all Stripe products, prices, and payment links automatically.

---

## Email nurture (7-email trial sequence)

Triggered automatically when a user confirms their email. Uses **Resend** for delivery.

| Email | Timing | Subject |
|---|---|---|
| 1 | Immediately on sign-up | Welcome — here's how to get Phoebe answering calls today |
| 2 | Day 1 | Did Phoebe answer her first call? |
| 3 | Day 2 | The call you didn't know you missed |
| 4 | Day 4 | Halfway through your trial — here's what Phoebe can do |
| 5 | Day 6 | Your trial ends tomorrow |
| 6 | Day 7 | Last day — keep Phoebe or she goes quiet |
| 7 | Day 14 (non-converters only) | Quick question (winback) |

**How it works:**

- `supabase/setup.sql` creates an `email_nurture` table and attaches a Postgres trigger to `auth.users`
- When a user confirms their email, the trigger calls the `on-signup` Edge Function via `pg_net`, which inserts the user and sends Email 1 immediately
- `pg_cron` runs the `send-nurture` Edge Function every hour — it checks which users are due their next email and sends it
- Email 7 is skipped for users who have already converted (`trial_converted = true`)

---

## Voice agent (Vapi)

Each client (business) is a separate Vapi assistant configured from a JSON file in `clients/`.

**Tools the agent can use:**
- `checkAvailability` — fetches open slots from Cal.com for a given date range
- `bookLesson` — creates a booking in Cal.com with the caller's name, email and phone

The server (`POST /vapi/tools`) routes tool calls to the right client's Cal.com calendar using `metadata.clientId` on the assistant.

---

## Per-client setup (onboarding a new business)

1. Copy `clients/driving-instructor.json` → `clients/<new-client>.json`
2. Fill in business name, voice id, Cal.com `eventTypeId`, prices, FAQ
3. Start the server and expose it:
   ```bash
   pnpm server          # in one terminal
   ngrok http 3000      # in another — paste the HTTPS URL into .env as SERVER_URL
   ```
4. Provision the Vapi agent:
   ```bash
   pnpm provision <new-client>
   ```
   First run creates the agent and saves its id back into the client file; later runs update it.
5. Attach a phone number to that assistant in the Vapi dashboard.

---

## First-time setup

### 1. Accounts you need (one-off)

| Service | What for |
|---|---|
| [Vapi](https://dashboard.vapi.ai) | Voice AI — copy your private API key |
| [ElevenLabs](https://elevenlabs.io) | Realistic voice — copy a Voice ID |
| [Cal.com](https://cal.com) | Booking calendar — create an event type + API key |
| [Stripe](https://stripe.com) | Payments — copy secret key + set up webhook |
| [Supabase](https://supabase.com) | Auth + database — copy URL + service role key |
| [Resend](https://resend.com) | Email — copy API key |

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in:
```
VAPI_API_KEY=
CALCOM_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_BASIC=
STRIPE_PRICE_PROFESSIONAL=
STRIPE_PRICE_PREMIUM=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SERVER_URL=
```

### 3. Supabase database

Run `supabase/setup.sql` in the Supabase SQL Editor. This:
- Creates the `email_nurture` table with row-level security
- Attaches the email-confirm trigger to `auth.users`
- Schedules the hourly nurture cron job via `pg_cron`

### 4. Stripe products

```bash
pnpm stripe-setup
```

Paste the printed payment link URLs into the plan CTAs in `website/index.html` and `website/dashboard.html`.

### 5. Run

```bash
pnpm install
pnpm server    # runs on port 3000
```

Use a process manager (PM2, Railway, Render, etc.) in production. Register `SERVER_URL/stripe/webhook` as your Stripe webhook endpoint (events needed: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_succeeded`).

---

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm server` | Start the Express server (website + Stripe webhook + Vapi tools) |
| `pnpm provision <client>` | Create/update a client's Vapi voice agent |
| `pnpm list` | List all agents in your Vapi account |
| `pnpm stripe-setup` | Create Stripe products, prices, and payment links |

---

## Call costs

There is no fully free option — every call costs ~£0.06–0.12/min (phone line + speech-to-text + AI + voice). A 3-minute booking call ≈ 18–36p. Vapi and ElevenLabs give free starter credits so testing costs nothing.

---

## Notes

- Cal.com's API versions move; if slots/bookings return 4xx, check the `cal-api-version` header values in `src/lib/calcom.js` against the current Cal.com docs.
- The agent uses `gpt-4o-mini` as the brain — swap the `model` in the client config if a business needs something stronger.
- The Supabase `setup.sql` file contains the service role key inline (required for the `pg_net` DB trigger). Treat this file as a secret — do not commit it to a public repo.
