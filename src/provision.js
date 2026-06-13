// Create or update a client's Vapi voice agent from their config file.
//
//   pnpm provision driving-instructor
//
// Idempotent: the first run creates the assistant and writes its id back into
// the client file; later runs update the same assistant in place.
import "dotenv/config";
import { loadClient, saveClient } from "./lib/clients.js";
import { buildAssistant } from "./assistant-template.js";
import { vapi } from "./lib/vapi.js";

const name = process.argv[2];
if (!name) {
  console.error("Usage: pnpm provision <client-file>   e.g. pnpm provision driving-instructor");
  process.exit(1);
}

const client = await loadClient(name);

// Friendly guardrails so you don't ship a half-filled config.
if (!client.voice?.voiceId || client.voice.voiceId.startsWith("REPLACE")) {
  console.error(`✗ ${client._file}: set voice.voiceId to a real ElevenLabs voice id first.`);
  process.exit(1);
}

const payload = buildAssistant(client);
const existingId = client._vapi?.assistantId;

let result;
if (existingId) {
  result = await vapi.updateAssistant(existingId, payload);
  console.log(`✓ Updated assistant ${result.id} for ${client.businessName}`);
} else {
  result = await vapi.createAssistant(payload);
  client._vapi = { ...(client._vapi || {}), assistantId: result.id };
  await saveClient(client);
  console.log(`✓ Created assistant ${result.id} for ${client.businessName}`);
  console.log("  (saved the id back into the client file)");
}

console.log("\nNext: attach a phone number to this assistant in the Vapi dashboard,");
console.log("or buy/import one, then point it at assistant id:", result.id);
