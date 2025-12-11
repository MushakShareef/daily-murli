// pages/admin.jsx
import React, { useState } from "react";

export default function AdminPage() {
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  });
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [tokenInput, setTokenInput] = useState("");

  async function saveMurli() {
    setMessage("");
    const token = tokenInput || prompt("Enter admin token (ADMIN_TOKEN)");
    if (!token) {
      setMessage("Save cancelled (no token).");
      return;
    }

    setMessage("Saving...");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          content,
          metadata: { morning_murli: "प्रात:मुरली" },
          adminToken: token
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage("Error: " + (json?.error || JSON.stringify(json)));
      } else {
        setMessage("Saved! — " + (json?.date || ""));
      }
    } catch (err) {
      setMessage("Network or server error: " + String(err));
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
      <h2>Admin — paste Murli</h2>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Date (YYYY-MM-DD):</label>
        <input value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: 8, width: "200px" }} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Admin token (optional):</label>
        <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} style={{ padding: 8, width: "100%" }} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Murli content (HTML allowed):</label>
        <textarea rows={12} value={content} onChange={(e) => setContent(e.target.value)} style={{ width: "100%", padding: 10 }} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={saveMurli} style={{ padding: "10px 14px", background: "#111", color: "#fff", border: "none", borderRadius: 6 }}>
          Save Murli
        </button>

        <button onClick={() => { setContent(""); setMessage(""); }} style={{ padding: "10px 14px", background: "#fff", color: "#111", border: "1px solid #ddd", borderRadius: 6 }}>
          Clear
        </button>
      </div>

      <div style={{ marginTop: 12, color: message.startsWith("Error") ? "#b00" : "#080" }}>
        {message}
      </div>

      <div style={{ marginTop: 20, fontSize: 13, color: "#555" }}>
        <div><strong>Note:</strong> This page posts to <code>/api/admin</code>. The API checks the token from the request body (<code>adminToken</code>) or header <code>x-admin-token</code> and compares it to <code>process.env.ADMIN_TOKEN</code>. Make sure your `.env.local` has <code>ADMIN_TOKEN</code> and restart the server after changes.</div>
      </div>
    </div>
  );
}
