// pages/api/debug-supabase.js
// Safe debug endpoint to check whether the running Vercel instance
// can reach Supabase using SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// It will NOT reveal secrets; it only returns status info.

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL || null;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({
      ok: false,
      reason: "missing_env",
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY
    });
  }

  try {
    // Attempt a safe read: request 1 row (no keys or secrets returned)
    const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/murlis?select=id&limit=1`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        // Prefer header not needed here
      },
    });

    const text = await resp.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) { json = null; }

    return res.status(200).json({
      ok: true,
      supabaseFetch: {
        status: resp.status,
        ok: resp.ok,
        // If response is JSON array, return its length. Otherwise return first 300 chars for debugging.
        returnedCount: Array.isArray(json) ? json.length : null,
        returnedPreview: (!Array.isArray(json) && typeof text === "string") ? text.slice(0, 300) : undefined
      }
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      reason: "fetch_failed",
      error: String(err && (err.message || err))
    });
  }
}
