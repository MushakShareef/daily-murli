// pages/api/murli.js
// Supabase-backed murli API (no external deps)
// - POST: save murli (requires ADMIN_TOKEN via body.adminToken or header x-admin-token)
// - GET: return most recent murli (latest created_at)
// - Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in environment.");
}

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`;
  const headers = Object.assign({
    "Content-Type": "application/json",
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Prefer": "return=representation"
  }, options.headers || {});
  const resp = await fetch(url + (options.qs || ""), {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) { json = null; }
  return { status: resp.status, text, json, ok: resp.ok };
}

export default async function handler(req, res) {
  // GET -> return latest murli
  if (req.method === "GET") {
    try {
      // support optional ?date=YYYY-MM-DD to fetch specific date
      const dateQuery = req.query?.date;
      if (dateQuery) {
        // filter by date column
        const qs = `?select=*&date=eq.${encodeURIComponent(dateQuery)}&limit=1`;
        const { status, json, ok } = await supabaseFetch("murlis", { qs });
        if (!ok || !Array.isArray(json) || json.length === 0) {
          return res.status(404).json({ error: "No Murli for date", date: dateQuery });
        }
        return res.status(200).json(json[0]);
      }

      // otherwise return latest row (order by created_at desc)
      const { status, json } = await supabaseFetch("murlis", { qs: "?select=*,created_at&order=created_at.desc&limit=1" });
      if (!json || !Array.isArray(json) || json.length === 0) {
        return res.status(200).json(null);
      }
      return res.status(200).json(json[0]);
    } catch (err) {
      console.error("murli GET error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // POST -> insert (admin only)
  if (req.method === "POST") {
    try {
      const token = req.body?.adminToken || req.headers["x-admin-token"];
      if (!token || !ADMIN_TOKEN || token !== ADMIN_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { date, content, metadata } = req.body || {};
      if (!content) {
        return res.status(400).json({ error: "Missing content" });
      }

      const row = {
        date: date || null,
        content,
        metadata: metadata || null
      };

      const { status, json, ok } = await supabaseFetch("murlis", { method: "POST", body: row });
      if (!ok) {
        console.error("Supabase insert failed:", status, json || (await supabaseFetch("murlis").text));
        return res.status(500).json({ error: "Failed to save murli", details: json || null });
      }

      // json is an array of inserted rows because return=representation
      const inserted = Array.isArray(json) && json.length ? json[0] : null;
      return res.status(200).json({ ok: true, date: inserted?.date || null, id: inserted?.id || null });
    } catch (err) {
      console.error("murli POST error:", err && (err.stack || err));
      return res.status(500).json({ error: "Internal server error", details: String(err && err.message) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
