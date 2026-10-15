/**
 * SERVERFORGE Cloudflare Worker
 * Deploy this as a Worker, then add these Worker secrets:
 *   FALIX_API_KEY       = your Falix flx_live_... API key
 *   SERVERFORGE_PASSWORD = a new, strong password used only to access this Worker
 *
 * Only the SERVERFORGE GitHub Pages origin is allowed by CORS.
 * This is a narrow proxy; it is not a general-purpose URL proxy.
 */
const SITE_ORIGIN = "https://coolboy8297.github.io";
const FALIX_BASE = "https://client.falixnodes.net/api/v2";

function json(data, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  if (origin === SITE_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = SITE_ORIGIN;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-Serverforge-Password";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin && origin !== SITE_ORIGIN) {
      return json({ error: { code: "origin_not_allowed", message: "This origin is not allowed." } }, 403);
    }
    if (request.method === "OPTIONS") {
      if (origin !== SITE_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": SITE_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Serverforge-Password",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }

    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "SERVERFORGE proxy" }, 200, origin);
    }

    if (!env.FALIX_API_KEY || !env.SERVERFORGE_PASSWORD) {
      return json({ error: { code: "worker_not_configured", message: "Add FALIX_API_KEY and SERVERFORGE_PASSWORD as Worker secrets." } }, 500, origin);
    }
    const suppliedPassword = request.headers.get("X-Serverforge-Password") || "";
    if (suppliedPassword.length < 1 || suppliedPassword !== env.SERVERFORGE_PASSWORD) {
      return json({ error: { code: "unauthorized", message: "SERVERFORGE access password is incorrect." } }, 401, origin);
    }

    let upstreamPath = null;
    let forwardedBody = null;
    const path = url.pathname;

    if (request.method === "GET" && path === "/api/me") {
      upstreamPath = "/me";
    } else if (request.method === "GET" && path === "/api/servers") {
      const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "100", 10) || 100));
      const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0);
      upstreamPath = "/servers?limit=" + limit + "&offset=" + offset;
    } else {
      const logMatch = path.match(/^\/api\/servers\/(\d+)\/console\/log$/);
      const powerMatch = path.match(/^\/api\/servers\/(\d+)\/power$/);
      const commandMatch = path.match(/^\/api\/servers\/(\d+)\/commands$/);
      if (request.method === "GET" && logMatch) {
        const lines = Math.min(40, Math.max(5, Number.parseInt(url.searchParams.get("lines") || "40", 10) || 40));
        upstreamPath = "/servers/" + logMatch[1] + "/console/log?lines=" + lines;
      } else if (request.method === "POST" && powerMatch) {
        let body;
        try { body = await request.json(); } catch { return json({ error: { code: "bad_request", message: "Expected JSON body." } }, 400, origin); }
        if (!body || !["start", "stop", "restart", "kill"].includes(body.signal)) {
          return json({ error: { code: "bad_request", message: "signal must be start, stop, restart, or kill." } }, 400, origin);
        }
        upstreamPath = "/servers/" + powerMatch[1] + "/power";
        forwardedBody = JSON.stringify({ signal: body.signal });
      } else if (request.method === "POST" && commandMatch) {
        let body;
        try { body = await request.json(); } catch { return json({ error: { code: "bad_request", message: "Expected JSON body." } }, 400, origin); }
        if (!body || typeof body.command !== "string" || !body.command.trim() || body.command.length > 500 || /[\r\n]/.test(body.command)) {
          return json({ error: { code: "bad_request", message: "command must be a single non-empty line of at most 500 characters." } }, 400, origin);
        }
        upstreamPath = "/servers/" + commandMatch[1] + "/commands";
        forwardedBody = JSON.stringify({ command: body.command.trim() });
      }
    }

    if (!upstreamPath) {
      return json({ error: { code: "not_found", message: "Route or method is not available through this proxy." } }, 404, origin);
    }

    const method = request.method;
    const headers = new Headers({
      "Authorization": "Bearer " + env.FALIX_API_KEY,
      "Accept": "application/json",
    });
    let body;
    if (method === "POST") {
      headers.set("Content-Type", "application/json");
      body = forwardedBody ?? await request.text();
    }

    try {
      const upstream = await fetch(FALIX_BASE + upstreamPath, {
        method,
        headers,
        body,
        redirect: "manual",
      });
      const responseText = await upstream.text();
      let responseBody;
      try { responseBody = JSON.parse(responseText); }
      catch { responseBody = { error: { code: "invalid_upstream_response", message: "Falix returned a non-JSON response." } }; }
      return json(responseBody, upstream.status, origin);
    } catch {
      return json({ error: { code: "upstream_unavailable", message: "Could not reach the Falix API from the Worker." } }, 502, origin);
    }
  },
};
