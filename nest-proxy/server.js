const express = require("express");

const app = express();
app.disable("x-powered-by");

const PORT = Number(process.env.PORT) || 3000;
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

// Intentionally restricted: only these public HTTPS domains can be fetched.
// Add a domain only when you have permission to make it available.
const ALLOWED_HOSTS = new Set([
  "example.com",
  "wikipedia.org",
  "www.wikipedia.org",
  "en.wikipedia.org",
  "nasa.gov",
  "www.nasa.gov",
  "github.com",
  "www.github.com"
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || origin === "https://coolboy8297.github.io") {
    res.setHeader("Access-Control-Allow-Origin", origin || "https://coolboy8297.github.io");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function isAllowedUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" &&
    !parsed.username &&
    !parsed.password &&
    (ALLOWED_HOSTS.has(parsed.hostname.toLowerCase()));
}

function stripHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 12_000);
}

async function fetchAllowedPage(startUrl) {
  let current = new URL(startUrl);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    if (!isAllowedUrl(current.href)) {
      const err = new Error("That destination is not on NEST's approved website list.");
      err.status = 403;
      throw err;
    }

    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "NESTBrowserPreview/1.0",
        "Accept": "text/html,application/xhtml+xml;q=0.9"
      }
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) {
        const err = new Error("Too many redirects.");
        err.status = 502;
        throw err;
      }
      current = new URL(location, current);
      continue;
    }

    if (!response.ok) {
      const err = new Error("The website returned HTTP " + response.status + ".");
      err.status = 502;
      throw err;
    }

    const type = (response.headers.get("content-type") || "").toLowerCase();
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) {
      const err = new Error("For safety, NEST preview only supports HTML pages.");
      err.status = 415;
      throw err;
    }

    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_BYTES) {
      const err = new Error("That page is too large to preview.");
      err.status = 413;
      throw err;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        const err = new Error("That page is too large to preview.");
        err.status = 413;
        throw err;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { html: new TextDecoder("utf-8").decode(bytes), finalUrl: current.href, contentType: type };
  }

  const err = new Error("Could not fetch that page.");
  err.status = 502;
  throw err;
}

app.get("/", (_req, res) => {
  res.json({
    name: "NEST restricted page preview",
    status: "online",
    mode: "HTML-to-text preview",
    approvedSites: Array.from(ALLOWED_HOSTS).sort(),
    endpoint: "/api/preview?url=https%3A%2F%2Fexample.com"
  });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/preview", async (req, res) => {
  const target = req.query.url;
  if (typeof target !== "string" || !isAllowedUrl(target)) {
    return res.status(403).json({
      error: "Only approved HTTPS websites can be previewed.",
      approvedSites: Array.from(ALLOWED_HOSTS).sort()
    });
  }

  try {
    const page = await fetchAllowedPage(target);
    const titleMatch = page.html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
    const title = titleMatch
      ? stripHtml(titleMatch[1]).slice(0, 200)
      : new URL(page.finalUrl).hostname;

    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json({
      title,
      url: page.finalUrl,
      text: stripHtml(page.html),
      note: "Restricted text preview; scripts, styles, images, and interactive features are not loaded."
    });
  } catch (error) {
    const status = Number(error.status) || (error.name === "TimeoutError" ? 504 : 502);
    return res.status(status).json({ error: error.message || "Could not fetch that page." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("NEST restricted preview API listening on port " + PORT);
});
