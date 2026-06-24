# Lead-gen scraper — driving instructors

Find driving instructors in a UK town, pull their public phone number, and have
Claude write a personalised cold-outreach opener for each — in Phoebe's voice.

## Setup (one time)

1. **Google Places API key** — go to [console.cloud.google.com](https://console.cloud.google.com),
   create a project, enable **Places API (New)**, and create an API key.
   Google gives a generous free monthly credit; Text Search is cheap.
2. **Anthropic API key** (optional, for the opener lines) — from
   [console.anthropic.com](https://console.anthropic.com).
3. Put both in your `.env`:

   ```
   GOOGLE_PLACES_API_KEY=...
   ANTHROPIC_API_KEY=...
   ```

## Run

```bash
# Find up to 60 instructors in Leeds, with AI opener lines
pnpm leads "Leeds"

# Cap the count, skip the AI lines
pnpm leads "Liverpool" --max 30 --no-ai
```

Output lands next to the script as `leads-<town>.csv` with columns:
`name, phone, website, address, rating, reviews, opener`.

## How to actually use the list

1. Sort by `reviews` ascending — newer/smaller instructors feel the missed-call
   pain hardest and are easiest to win.
2. The `opener` is your first line. Follow it with the pain-bridge-solution
   formula from [../brand-voice.md](../brand-voice.md): name the pain, bridge,
   offer the free trial.
3. Call them **outside lesson hours** (early evening). If it goes to voicemail —
   that *is* the pitch. "You just sent me to voicemail. That's the call Phoebe
   would've answered."

## Notes

- Only businesses with a public Google profile show up. Many instructors are
  reachable this way; some only advertise on Facebook/Yell.
- This finds leads — it does **not** contact anyone. Sending is on you, so you
  stay compliant with UK PECR/GDPR (B2B cold outreach is allowed, but honour
  opt-outs and identify yourself).
- Want a different niche? Change `driving instructors in` in
  [find-instructors.js](find-instructors.js) to `mobile dog groomers in`,
  `mobile mechanics in`, etc. The opener prompt is instructor-specific — tweak
  the `SYSTEM` string to match.
