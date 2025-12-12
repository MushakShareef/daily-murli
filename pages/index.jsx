// pages/index.jsx
import React from "react";

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
                {/* optional display of metadata */}
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
    </div>
  );
}

export async function getServerSideProps(context) {
  // build absolute base url for SSR fetch
  const VERCEL_URL = process.env.VERCEL_URL;
  const baseUrl = VERCEL_URL ? `https://${VERCEL_URL}` : `http://localhost:3000`;

  // server-side today (uses server time)
  const today = formatDateYYYYMMDD(new Date());

  try {
    // try date-specific first
    let resp = await fetch(`${baseUrl}/api/murli?date=${encodeURIComponent(today)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (resp.ok) {
      const data = await resp.json();
      return { props: { murli: data || null, usedDate: today } };
    }

    // if date-specific not available (404 or not ok), fallback to latest
    resp = await fetch(`${baseUrl}/api/murli`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (resp.ok) {
      const data = await resp.json();
      // find display date: prefer murli.date, else today's date
      const displayDate = (data && data.date) ? data.date : today;
      return { props: { murli: data || null, usedDate: displayDate } };
    }

    // final fallback
    return { props: { murli: null, usedDate: today } };
  } catch (err) {
    console.error("getServerSideProps fetch error:", err);
    return { props: { murli: null, usedDate: today } };
  }
}
