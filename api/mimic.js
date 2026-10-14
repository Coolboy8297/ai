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
  if (!process.env.HF_TOKEN) {
    return res.status(503).json({ error: "HF_TOKEN is not configured on the server." });
  }

  // Best-effort per-instance throttle.
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : String(forwarded || "unknown").split(",")[0]).trim();
  const now = Date.now();
  const hits = (recentRequests.get(ip) || []).filter(t => now - t < 60_000);
  if (hits.length >= 12) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
  }
  hits.push(now);
  recentRequests.set(ip, hits);
  if (recentRequests.size > 500) {
    for (const [key, times] of recentRequests) {
      if (!times.some(t => now - t < 60_000)) recentRequests.delete(key);
    }
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
    if (!messages.length) {
      return res.status(400).json({ error: "No valid messages provided." });
    }

    const upstream = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.HF_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.HF_MODEL || "openai/gpt-oss-20b:cheapest",
        messages,
        max_tokens: 350,
        stream: false
      })
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = typeof data.error === "string" ? data.error : "Hugging Face inference request failed.";
      return res.status(upstream.status >= 500 ? 502 : upstream.status).json({ error: message });
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return res.status(502).json({ error: "The model returned an empty response." });
    }

    return res.status(200).json({
      message: { role: "assistant", content },
      model: data.model || process.env.HF_MODEL || "openai/gpt-oss-20b:cheapest"
    });
  } catch {
    return res.status(500).json({ error: "The AI backend could not complete the request." });
  }
}
