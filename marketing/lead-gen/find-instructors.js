// Lead-gen scraper for Phone Phoebe — driving instructors.
//
// Finds driving instructors in a UK town via the Google Places API, then uses
// Claude to write a personalised one-line cold-outreach opener for each one in
// Phoebe's brand voice. Outputs a CSV you can work straight from.
//
//   node marketing/lead-gen/find-instructors.js "Leeds"
//   node marketing/lead-gen/find-instructors.js "Leeds" --max 40 --no-ai
//
// Needs in .env:
//   GOOGLE_PLACES_API_KEY   (Places API "New" — enable it in Google Cloud)
//   ANTHROPIC_API_KEY       (only if you want the AI opener lines)

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const location = args.find((a) => !a.startsWith('--'));
const maxFlag = args.indexOf('--max');
const MAX = maxFlag !== -1 ? Number(args[maxFlag + 1]) : 60;
const useAI = !args.includes('--no-ai');

if (!location) {
  console.error('Usage: node marketing/lead-gen/find-instructors.js "<town>" [--max N] [--no-ai]');
  process.exit(1);
}

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!PLACES_KEY) {
  console.error(
    '\nMissing GOOGLE_PLACES_API_KEY in .env.\n' +
      'Get one at https://console.cloud.google.com → enable "Places API (New)" → create an API key.\n',
  );
  process.exit(1);
}

// ── 1. find instructors via Google Places (New) Text Search ──────────────────
// One call returns name, address, phone and website via the field mask — no
// separate "place details" call needed. Paginates up to ~60 results.
async function findInstructors(town) {
  const results = [];
  let pageToken;

  do {
    const body = { textQuery: `driving instructors in ${town}, UK`, regionCode: 'GB' };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': PLACES_KEY,
        'X-Goog-FieldMask':
          'places.displayName,places.formattedAddress,places.nationalPhoneNumber,' +
          'places.websiteUri,places.rating,places.userRatingCount,nextPageToken',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Places API ${res.status}: ${text}`);
    }

    const data = await res.json();
    for (const p of data.places ?? []) {
      results.push({
        name: p.displayName?.text ?? '',
        address: p.formattedAddress ?? '',
        phone: p.nationalPhoneNumber ?? '',
        website: p.websiteUri ?? '',
        rating: p.rating ?? '',
        reviews: p.userRatingCount ?? '',
      });
    }

    pageToken = data.nextPageToken;
    // The next page token needs a short beat before it's valid.
    if (pageToken && results.length < MAX) await new Promise((r) => setTimeout(r, 2000));
  } while (pageToken && results.length < MAX);

  return results.slice(0, MAX);
}

// ── 2. personalised opener lines via Claude (one batched call) ───────────────
const SYSTEM = `You write cold-outreach opening lines for Phone Phoebe, an AI phone receptionist for UK driving instructors. Phoebe answers calls instructors miss while they're teaching, captures the caller's details, and texts them straight over — from £39/month.

Brand voice: warm, plain-spoken, British English, honest, never salesy or corporate. Never say "AI-powered", "solution", "leverage", "seamless", or "innovative". The core pain: instructors can't answer the phone mid-lesson, so missed calls go to the next instructor.

For each instructor, write ONE opening line (max 25 words) for a cold email or DM. It must:
- Reference something specific about THEM (their name, area, or that they teach) so it doesn't read like a blast.
- Land the missed-call pain lightly, not heavily.
- Sound like a real person, not marketing. No emoji. No "Hope you're well".
Do not pitch the product or price in the opener — just earn the next sentence.`;

async function writeOpeners(leads) {
  const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

  const roster = leads.map((l, i) => ({
    i,
    name: l.name,
    area: l.address,
    teaches: 'driving lessons',
  }));

  const response = await anthropic.beta.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            openers: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  i: { type: 'integer' },
                  opener: { type: 'string' },
                },
                required: ['i', 'opener'],
              },
            },
          },
          required: ['openers'],
        },
      },
    },
    messages: [
      {
        role: 'user',
        content:
          'Write an opening line for each instructor. Return them keyed by index.\n\n' +
          JSON.stringify(roster, null, 2),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const parsed = JSON.parse(textBlock.text);
  const byIndex = new Map(parsed.openers.map((o) => [o.i, o.opener]));
  return byIndex;
}

// ── 3. write CSV ─────────────────────────────────────────────────────────────
function toCsv(rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['name', 'phone', 'website', 'address', 'rating', 'reviews', 'opener'];
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => cell(r[h])).join(','));
  return lines.join('\n');
}

// ── run ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\nSearching driving instructors in ${location}…`);
  const leads = await findInstructors(location);
  console.log(`Found ${leads.length} instructors.`);

  const withPhone = leads.filter((l) => l.phone);
  console.log(`${withPhone.length} have a public phone number.`);

  if (useAI && process.env.ANTHROPIC_API_KEY && leads.length) {
    console.log('Writing personalised opener lines with Claude…');
    try {
      const openers = await writeOpeners(leads);
      leads.forEach((l, i) => (l.opener = openers.get(i) ?? ''));
    } catch (err) {
      console.warn(`Opener generation failed (${err.message}). Writing leads without openers.`);
    }
  } else if (useAI) {
    console.log('No ANTHROPIC_API_KEY set — skipping opener lines (--no-ai to silence this).');
  }

  const slug = location.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const outPath = path.join(__dirname, `leads-${slug}.csv`);
  fs.writeFileSync(outPath, toCsv(leads));
  console.log(`\nWrote ${leads.length} leads → ${path.relative(process.cwd(), outPath)}\n`);
})().catch((err) => {
  console.error('\nError:', err.message, '\n');
  process.exit(1);
});
