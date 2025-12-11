// pages/admin.jsx
import React, { useState } from "react";
import dayjs from "dayjs";

export default function Admin() {
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");

  const save = async () => {
    // prompt for token (development only)
    const token = prompt("Enter admin token (value from .env.local ADMIN_TOKEN)");
    if (!token) {
      setMessage("Save cancelled (no token).");
      return;
    }

    setMessage("Saving...");
    try {
      const res = await fetch("/api/murli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, content, metadata: { morning_murli: "प्रात:मुरली" }, adminToken: token })
      });
      const j = await res.json();
      if (!res.ok) {
        setMessage("Error: " + (j?.error || JSON.stringify(j)));
      } else {
        setMessage("Saved!");
      }
    } catch (err) {
      console.error(err);
      setMessage("Network error while saving.");
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
      <h2>Admin — paste Murli</h2>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Date (YYYY-MM-DD):</label>
        <input
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: 8, width: "200px", borderRadius: 6, border: "1px solid #ddd" }}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Murli content (you can paste plain text or HTML):</label>
        <textarea
          rows={12}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd", fontSize: 14 }}
        />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={save} style={{ padding: "10px 14px", background: "#111", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          Save
        </button>

        <button onClick={() => { setContent(""); setMessage(""); }} style={{ padding: "10px 14px", background: "#fff", color: "#111", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}>
          Clear
        </button>
      </div>

      <div style={{ marginTop: 12, color: message.startsWith("Error") ? "#b00" : "#080" }}>
        {message}
      </div>

      <div style={{ marginTop: 20, fontSize: 13, color: "#555" }}>
        <div><strong>Note:</strong> This admin page uses a simple token prompt for development. Use the same ADMIN_TOKEN value you put in <code>.env.local</code> (for example: <code>devsecret</code>).</div>
      </div>
    </div>
  );
}
