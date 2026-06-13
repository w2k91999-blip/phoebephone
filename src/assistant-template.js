// Turns a plain client config into a Vapi "assistant" payload.
// Edit the prose here once and every client you provision inherits the upgrade.

const SERVER_URL = process.env.SERVER_URL;

function systemPrompt(c) {
  const faq = c.faq?.length
    ? c.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n")
    : "None provided.";

  return `You are ${c.agentName}, the friendly phone receptionist for ${c.businessName}.
You answer the phone, sound warm and natural, and your main job is to BOOK driving lessons.

# Voice & style
- Speak like a real person on the phone: short sentences, contractions, the odd "sure" or "no worries".
- Never say you are an AI unless directly asked. If asked, be honest and stay friendly.
- One question at a time. Don't read long lists of times — offer two or three options.

# What ${c.businessName} offers
- Services: ${c.businessInfo.services}
- Areas covered: ${c.businessInfo.areas}
- Price: ${c.businessInfo.hourlyRate}
- Hours: ${c.businessInfo.hours}

# Booking flow
1. Greet, ask how you can help.
2. If they want a lesson, find out roughly when suits them (e.g. "weekday mornings", "this Saturday").
3. Call the checkAvailability tool to get real open slots, then offer two or three.
4. Once they pick one, collect their full name and a contact email, and a mobile number.
5. Call the bookLesson tool with those details to confirm the booking.
6. Read back the confirmed day and time, and say they'll get a confirmation by email.

# Rescheduling / cancelling
- If they want to change or cancel, take their name and the original day/time and tell them
  the instructor will text them back shortly to sort it. (Don't promise instant changes.)

# Common questions
${faq}

# Rules
- Only offer times that checkAvailability actually returned. Never invent availability.
- If a tool fails or you're unsure, take a message: name + number, and say the instructor will call back.
- Keep calls efficient and polite. End warmly.`;
}

// Two function tools the agent can call. Both point at this project's /vapi/tools
// webhook, which talks to Cal.com. Vapi sends the toolCallId + arguments there.
function tools(c) {
  if (!SERVER_URL) {
    console.warn("⚠  SERVER_URL is not set — provisioning without booking tools.");
    return [];
  }
  const server = { url: `${SERVER_URL.replace(/\/$/, "")}/vapi/tools` };

  return [
    {
      type: "function",
      function: {
        name: "checkAvailability",
        description:
          "Get real open lesson slots for a date range. Call before offering any times.",
        parameters: {
          type: "object",
          properties: {
            startDate: { type: "string", description: "ISO date, start of range, e.g. 2026-06-15" },
            endDate: { type: "string", description: "ISO date, end of range, e.g. 2026-06-20" }
          },
          required: ["startDate", "endDate"]
        }
      },
      server
    },
    {
      type: "function",
      function: {
        name: "bookLesson",
        description: "Book a confirmed lesson once the caller has chosen a slot and given their details.",
        parameters: {
          type: "object",
          properties: {
            start: { type: "string", description: "ISO datetime of the chosen slot, from checkAvailability" },
            name: { type: "string", description: "Caller's full name" },
            email: { type: "string", description: "Caller's email for the confirmation" },
            phone: { type: "string", description: "Caller's mobile number" }
          },
          required: ["start", "name", "email", "phone"]
        }
      },
      server
    }
  ];
}

export function buildAssistant(c) {
  return {
    name: `${c.businessName} — phone agent`,
    firstMessage: `Hiya, thanks for calling ${c.businessName}, this is ${c.agentName}. How can I help?`,
    // Cheap, fast, capable brain. Swap to a bigger model only if a client needs it.
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [{ role: "system", content: systemPrompt(c) }],
      tools: tools(c)
    },
    // Realistic voice. 11labs = ElevenLabs. Set the client's chosen voiceId.
    voice: {
      provider: c.voice.provider,
      voiceId: c.voice.voiceId
    },
    transcriber: { provider: "deepgram", model: "nova-2", language: "en" },
    // Pass the client id through so the webhook knows which Cal.com calendar to use.
    metadata: { clientId: c.id, eventTypeId: c.calcom.eventTypeId }
  };
}
