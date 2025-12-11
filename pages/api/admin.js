// pages/api/admin.js
// Lightweight proxy handler that accepts admin POST from the UI and forwards to /api/murli.
// Returns JSON errors (never HTML) so the client doesn't choke on HTML pages.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    // Accept adminToken from body or x-admin-token header
    const adminToken = body.adminToken || req.headers["x-admin-token"];

    // Basic check: ensure an admin token was provided (the real check is in /api/murli)
    if (!adminToken) {
      return res.status(401).json({ error: "Missing admin token" });
    }

    // Forward the request to /api/murli on the same server.
    // Use absolute URL for local dev; Vercel will route accordingly.
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "localhost:3000";
    const url = `${protocol}://${host}/api/murli`;

    const forwardResp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await forwardResp.text();
    // Try to parse JSON result from /api/murli
    let json = null;
    try { json = JSON.parse(text); } catch (_) { json = null; }

    if (!forwardResp.ok) {
      // return whatever /api/murli returned (or a fallback)
      return res.status(forwardResp.status).json({ error: json?.error || text || "Upstream error" });
    }

    return res.status(200).json(json || { result: "ok", raw: text });
  } catch (err) {
    console.error("pages/api/admin.js error:", err && (err.stack || err.message || err));
    return res.status(500).json({ error: "Internal server error", details: String(err && (err.message || err)) });
  }
}
