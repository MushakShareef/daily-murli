// pages/index.jsx
import React from "react";

function formatDateYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function Home({ murli, date }) {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", fontFamily: "Georgia, serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Read Murli</h1>
          <div style={{ color: "#666" }}>Brahma Kumaris - Daily Murli</div>
        </div>
      </header>

      <main style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>{date}</h3>

        {murli ? (
          <div>
            {/* If content contains HTML, we render it */}
            <div dangerouslySetInnerHTML={{ __html: murli.content }} />
            <div style={{ marginTop: 20, color: "#777", fontSize: 13 }}>
              {murli.metadata ? <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(murli.metadata)}</pre> : null}
            </div>
          </div>
        ) : (
          <div style={{ padding: 24, color: "#444" }}>
            No Murli found for {date}.
          </div>
        )}
      </main>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  // Build base URL for server-side fetch.
  // Vercel sets process.env.VERCEL_URL in production; use that; in dev fallback to localhost
  const VERCEL_URL = process.env.VERCEL_URL;
  const base = VERCEL_URL ? `https://${VERCEL_URL}` : `http://localhost:3000`;

  // choose date (today on server)
  const today = formatDateYYYYMMDD(new Date());

  try {
    const resp = await fetch(`${base}/api/murli?date=${encodeURIComponent(today)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    // If API returns 404 for no murli for date, treat as no data
    if (!resp.ok) {
      // either 404 or other; return null
      return { props: { murli: null, date: today } };
    }

    const data = await resp.json();
    return { props: { murli: data || null, date: today } };
  } catch (err) {
    console.error("getServerSideProps error:", err);
    return { props: { murli: null, date: today } };
  }
}
