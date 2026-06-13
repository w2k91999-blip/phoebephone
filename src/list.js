// Quick overview of every assistant in your Vapi account.
//   pnpm list
import "dotenv/config";
import { vapi } from "./lib/vapi.js";

const assistants = await vapi.listAssistants();
if (!assistants?.length) {
  console.log("No assistants yet. Run: pnpm provision driving-instructor");
} else {
  for (const a of assistants) {
    console.log(`${a.id}  ${a.name ?? "(unnamed)"}`);
  }
}
