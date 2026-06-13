// Cal.com v2 helpers: read free slots and create a booking.
// Docs: https://cal.com/docs/api-reference/v2
const BASE = "https://api.cal.com/v2";

function headers(apiKey, version) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "cal-api-version": version,
    "Content-Type": "application/json"
  };
}

// Returns a flat array of ISO datetimes that are open for booking.
export async function getSlots({ apiKey, eventTypeId, startDate, endDate, timeZone }) {
  const url = new URL(`${BASE}/slots`);
  url.searchParams.set("eventTypeId", String(eventTypeId));
  url.searchParams.set("start", startDate);
  url.searchParams.set("end", endDate);
  url.searchParams.set("timeZone", timeZone);

  const res = await fetch(url, { headers: headers(apiKey, "2024-09-04") });
  const json = await res.json();
  if (!res.ok) throw new Error(`Cal.com slots ${res.status}: ${JSON.stringify(json)}`);

  // Response groups slots by day: { data: { "2026-06-15": [{ start }] , ... } }
  const byDay = json.data ?? {};
  return Object.values(byDay)
    .flat()
    .map((s) => s.start)
    .filter(Boolean);
}

export async function createBooking({ apiKey, eventTypeId, start, name, email, phone, timeZone }) {
  const res = await fetch(`${BASE}/bookings`, {
    method: "POST",
    headers: headers(apiKey, "2024-08-13"),
    body: JSON.stringify({
      start,
      eventTypeId,
      attendee: { name, email, timeZone, phoneNumber: phone, language: "en" },
      metadata: { source: "ai-phone-scheduler" }
    })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Cal.com booking ${res.status}: ${JSON.stringify(json)}`);
  return json.data ?? json;
}
