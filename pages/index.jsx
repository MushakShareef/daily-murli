// pages/index.jsx
import React from "react";
import SelectionTranslator from "../components/SelectionTranslator";


function formatDateYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function Home({ murli, usedDate }) {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", fontFamily: "Georgia, serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Read Murli</h1>
          <div style={{ color: "#666" }}>Brahma Kumaris - Daily Murli</div>
        </div>
      </header>

      <main style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>{usedDate ? usedDate : "Date"}</h3>

        {murli ? (
          <div>
            <div dangerouslySetInnerHTML={{ __html: murli.content }} />
            {murli.metadata && (
              <div style={{ marginTop: 12, color: "#777", fontSize: 13 }}>
                {typeof murli.metadata === "object" ? JSON.stringify(murli.metadata) : String(murli.metadata)}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 24, color: "#444" }}>
            No Murli available.
          </div>
        )}
      </main>
      <SelectionTranslator />
    </div>
  );
}

// Server-side only: call Supabase REST API directly using the service role key.
// This keeps the secret server-side (do NOT use NEXT_PUBLIC_ env for the key).
export async function getServerSideProps(context) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const today = formatDateYYYYMMDD(new Date());

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase envs missing in getServerSideProps");
    return { props: { murli: null, usedDate: today } };
  }

  const base = SUPABASE_URL.replace(/\/$/, "");
  // Helper to perform supabase rest query
  async function supabaseGet(qs) {
    const url = `${base}/rest/v1/murlis${qs}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const text = await resp.text();
    try {
      return { ok: resp.ok, status: resp.status, json: JSON.parse(text) };
    } catch {
      return { ok: resp.ok, status: resp.status, json: null, text };
    }
  }

  try {
    // 1) Try today
    const todayQs = `?select=*,created_at&date=eq.${encodeURIComponent(today)}&limit=1`;
    const tryToday = await supabaseGet(todayQs);
    if (tryToday.ok && Array.isArray(tryToday.json) && tryToday.json.length) {
      return { props: { murli: tryToday.json[0], usedDate: today } };
    }

    // 2) Fallback to latest
    const latestQs = `?select=*,created_at&order=created_at.desc&limit=1`;
    const latest = await supabaseGet(latestQs);
    if (latest.ok && Array.isArray(latest.json) && latest.json.length) {
      const displayDate = latest.json[0].date || today;
      return { props: { murli: latest.json[0], usedDate: displayDate } };
    }

    return { props: { murli: null, usedDate: today } };
  } catch (err) {
    console.error("getServerSideProps Supabase fetch error:", String(err));
    return { props: { murli: null, usedDate: today } };
  }
}
