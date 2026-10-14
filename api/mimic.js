const recentRequests = globalThis.__mimicRecentRequests || (globalThis.__mimicRecentRequests = new Map());

export default async function handler(req, res) {
  const allowedOrigin = "https://coolboy8297.github.io";
  const origin = req.headers.origin;
  if (origin && origin !== allowedOrigin) {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!process.env.OLLAMA_API_KEY) return res.status(503).json({ error: "OLLAMA_API_KEY is not configured on the server." });

  // Best-effort per-instance throttle; configure provider-level protection for stronger limits.
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : String(forwarded || "unknown").split(",")[0]).trim();
  const now = Date.now();
  const hits = (recentRequests.get(ip) || []).filter(t => now - t < 60_000);
  if (hits.length >= 12) return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
  hits.push(now);
  recentRequests.set(ip, hits);
  if (recentRequests.size > 500) {
    for (const [key, times] of recentRequests) if (!times.some(t => now - t < 60_000)) recentRequests.delete(key);
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || !Array.isArray(body.messages) || body.messages.length > 25) {
      return res.status(400).json({ error: "Invalid messages payload." });
    }
    const messages = body.messages.filter(m =>
      m && ["system", "user", "assistant"].includes(m.role) &&
      typeof m.content === "string" && m.content.length <= 12000
    );
    if (!messages.length) return res.status(400).json({ error: "No valid messages provided." });

    const upstream = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.OLLAMA_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "gpt-oss:20b-cloud",
        messages,
        stream: false
      })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return res.status(upstream.status >= 500 ? 502 : upstream.status).json({
        error: data.error || "Ollama Cloud request failed."
      });
    }
    return res.status(200).json({ message: data.message, model: data.model });
  } catch (error) {
    return res.status(500).json({ error: "The AI backend could not complete the request." });
  }
}