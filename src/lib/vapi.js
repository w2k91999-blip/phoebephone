// Tiny Vapi REST wrapper using native fetch (Node 18+).
const BASE = "https://api.vapi.ai";

function key() {
  const k = process.env.VAPI_API_KEY;
  if (!k) throw new Error("VAPI_API_KEY is missing. Copy .env.example to .env and fill it in.");
  return k;
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`Vapi ${method} ${path} -> ${res.status}: ${text}`);
  }
  return data;
}

export const vapi = {
  createAssistant: (payload) => call("POST", "/assistant", payload),
  updateAssistant: (id, payload) => call("PATCH", `/assistant/${id}`, payload),
  listAssistants: () => call("GET", "/assistant")
};
